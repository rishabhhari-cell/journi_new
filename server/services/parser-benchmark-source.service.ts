import { XMLParser } from "fast-xml-parser";
import { gunzipSync } from "zlib";
import type { StudyDesignBucket } from "./parser-benchmark.types";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PMC_ID_CONVERTER = "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/";
const PMC_OA_SERVICE = "https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi";
const PMC_AWS_BUCKET_URL = "https://pmc-oa-opendata.s3.amazonaws.com/";
const PMC_ID_CONVERTER_MAX_IDS = 180;
const SOURCE_FETCH_RETRIES = 4;
const EUTILS_MIN_INTERVAL_MS = 450;
const ENABLE_ELINK_FALLBACK = process.env.BENCHMARK_ENABLE_ELINK_FALLBACK === "true";

let lastEutilsRequestAt = 0;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("terminated") ||
    message.includes("socket") ||
    message.includes("timed out") ||
    message.includes("other side closed") ||
    message.includes("econnreset") ||
    message.includes("429") ||
    message.includes("rate limit")
  );
}

async function throttleEutils(url: string): Promise<void> {
  if (!url.startsWith(EUTILS_BASE)) return;
  const now = Date.now();
  const waitMs = Math.max(0, EUTILS_MIN_INTERVAL_MS - (now - lastEutilsRequestAt));
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastEutilsRequestAt = Date.now();
}

async function runWithRetry<T>(label: string, work: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SOURCE_FETCH_RETRIES; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt === SOURCE_FETCH_RETRIES || !isRetryableFetchError(error)) {
        throw error;
      }

      const waitMs = attempt * 1500;
      console.warn(`Retrying ${label} (${attempt}/${SOURCE_FETCH_RETRIES}) after network error: ${(error as Error).message}`);
      await sleep(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch failure");
}

async function fetchText(url: string): Promise<string> {
  const normalizedUrl = normalizeNcbiDownloadUrl(url);
  return runWithRetry(`text request ${url}`, async () => {
    await throttleEutils(normalizedUrl);
    const response = await fetch(normalizedUrl, {
      headers: {
        Accept: "application/xml, text/xml, application/json, text/plain",
        "User-Agent": "Journi Parser Benchmark/1.0",
      },
      signal: AbortSignal.timeout(60_000),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${normalizedUrl}: ${body.slice(0, 200)}`);
    }

    return body;
  });
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const normalizedUrl = normalizeNcbiDownloadUrl(url);
  return runWithRetry(`buffer request ${url}`, async () => {
    await throttleEutils(normalizedUrl);
    const response = await fetch(normalizedUrl, {
      headers: {
        Accept: "application/octet-stream, application/gzip, application/x-gzip, */*",
        "User-Agent": "Journi Parser Benchmark/1.0",
      },
      signal: AbortSignal.timeout(60_000),
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${normalizedUrl}: ${buffer.toString("utf8", 0, Math.min(buffer.length, 200))}`);
    }

    return buffer;
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  return runWithRetry(`json request ${url}`, async () => {
    await throttleEutils(url);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Journi Parser Benchmark/1.0",
      },
      signal: AbortSignal.timeout(60_000),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`);
    }

    return JSON.parse(body) as T;
  });
}

export interface PubmedArticleRecord {
  pmid: string;
  pmcid?: string;
  title: string;
  abstractText: string;
  journal?: string;
  publicationYear?: number;
  publicationTypesRaw: string[];
  isRetracted: boolean;
  doi?: string;
}

export async function searchPubmedIds(query: string, retstart = 0, retmax = 200): Promise<{ ids: string[]; totalCount: number }> {
  const url = new URL(`${EUTILS_BASE}/esearch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", query);
  url.searchParams.set("retmode", "json");
  url.searchParams.set("retstart", String(retstart));
  url.searchParams.set("retmax", String(retmax));
  url.searchParams.set("sort", "pub_date");

  const payload = await fetchJson<{
    esearchresult: { count: string; idlist: string[] };
  }>(url.toString());

  return {
    ids: payload.esearchresult.idlist,
    totalCount: Number(payload.esearchresult.count || 0),
  };
}

export async function fetchPubmedArticles(pmids: string[]): Promise<PubmedArticleRecord[]> {
  if (pmids.length === 0) return [];

  const url = new URL(`${EUTILS_BASE}/efetch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmids.join(","));
  url.searchParams.set("retmode", "xml");

  const xml = await fetchText(url.toString());
  const parsed = xmlParser.parse(xml) as {
    PubmedArticleSet?: {
      PubmedArticle?: unknown | unknown[];
    };
  };

  return ensureArray(parsed.PubmedArticleSet?.PubmedArticle).map((articleNode) => {
    const article = articleNode as Record<string, unknown>;
    const medlineCitation = article.MedlineCitation as Record<string, unknown>;
    const articleMeta = medlineCitation.Article as Record<string, unknown>;
    const pubmedData = article.PubmedData as Record<string, unknown>;
    const articleIds = ensureArray((pubmedData.ArticleIdList as Record<string, unknown> | undefined)?.ArticleId);
    const doiNode = articleIds.find((item) => typeof item === "object" && (item as Record<string, unknown>).IdType === "doi");
    const pmcNode = articleIds.find((item) => typeof item === "object" && String((item as Record<string, unknown>).IdType ?? "").toLowerCase() === "pmc");
    const title = normalizeText(textFromNode(articleMeta.ArticleTitle));
    const abstractText = normalizeText(textFromNode((articleMeta.Abstract as Record<string, unknown> | undefined)?.AbstractText));
    const journal = normalizeText(textFromNode((articleMeta.Journal as Record<string, unknown> | undefined)?.Title)) || undefined;
    const publicationTypesRaw = ensureArray((articleMeta.PublicationTypeList as Record<string, unknown> | undefined)?.PublicationType)
      .map((item) => normalizeText(textFromNode(item)))
      .filter(Boolean);
    const yearText =
      normalizeText(textFromNode((((articleMeta.Journal as Record<string, unknown> | undefined)?.JournalIssue as Record<string, unknown> | undefined)?.PubDate as Record<string, unknown> | undefined)?.Year)) ||
      normalizeText(textFromNode((((articleMeta.Journal as Record<string, unknown> | undefined)?.JournalIssue as Record<string, unknown> | undefined)?.PubDate as Record<string, unknown> | undefined)?.MedlineDate)).match(/\b(19|20)\d{2}\b/)?.[0] ||
      "";
    const publicationYear = /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;

    return {
      pmid: normalizeText(textFromNode(medlineCitation.PMID)),
      pmcid: normalizePmcid(normalizeText(textFromNode(pmcNode))) || undefined,
      title,
      abstractText,
      journal,
      publicationYear,
      publicationTypesRaw,
      isRetracted: publicationTypesRaw.some((type) => type.toLowerCase().includes("retracted publication")),
      doi: normalizeText(textFromNode(doiNode)) || undefined,
    };
  }).filter((record) => record.pmid);
}

export async function fetchPmcidMap(pmids: string[]): Promise<Map<string, string>> {
  if (pmids.length === 0) return new Map<string, string>();
  const map = new Map<string, string>();

  const uniquePmids = Array.from(
    new Set(
      pmids
        .map((pmid) => pmid.trim())
        .filter((pmid) => /^\d+$/.test(pmid)),
    ),
  );
  for (let index = 0; index < uniquePmids.length; index += PMC_ID_CONVERTER_MAX_IDS) {
    const chunk = uniquePmids.slice(index, index + PMC_ID_CONVERTER_MAX_IDS);
    const url = new URL(PMC_ID_CONVERTER);
    url.searchParams.set("ids", chunk.join(","));
    url.searchParams.set("format", "json");
    url.searchParams.set("idtype", "pmid");
    url.searchParams.set("tool", "journi_parser_benchmark");
    url.searchParams.set("email", "help@journie.io");

    const payload = await fetchJson<{
      records?: Array<{ pmid?: string | number; pmcid?: string | number }>;
    }>(url.toString());

    for (const record of payload.records ?? []) {
      if (record.pmid && record.pmcid) {
        const pmid = String(record.pmid).trim();
        const pmcidRaw = normalizePmcid(String(record.pmcid).trim());
        if (!pmid || !pmcidRaw) continue;
        map.set(pmid, pmcidRaw);
      }
    }
  }

  if (ENABLE_ELINK_FALLBACK) {
    const missingPmids = uniquePmids.filter((pmid) => !map.has(pmid));
    if (missingPmids.length > 0) {
      try {
        const elinkMap = await fetchPmcidMapViaElink(missingPmids);
        for (const [pmid, pmcid] of elinkMap.entries()) {
          map.set(pmid, pmcid);
        }
      } catch (error) {
        console.warn(`Skipping ELink fallback after failure: ${(error as Error).message}`);
      }
    }
  }

  return map;
}

export async function fetchPmcXmlByPmcid(pmcid: string): Promise<string> {
  const awsObjects = await resolvePmcAwsArticleObjects(pmcid);
  if (awsObjects?.xmlUrl) {
    return fetchText(awsObjects.xmlUrl);
  }

  const oaXmlUrl = await resolvePmcXmlUrl(pmcid);
  if (oaXmlUrl) {
    try {
      if (oaXmlUrl.toLowerCase().endsWith(".tar.gz") || oaXmlUrl.toLowerCase().endsWith(".tgz")) {
        const archive = await fetchBuffer(oaXmlUrl);
        return extractFirstNxmlFromTgz(archive);
      }
      return fetchText(oaXmlUrl);
    } catch (error) {
      console.warn(`PMC OA XML/package fetch failed for ${pmcid}; falling back to efetch: ${(error as Error).message}`);
    }
  }

  const url = new URL(`${EUTILS_BASE}/efetch.fcgi`);
  url.searchParams.set("db", "pmc");
  url.searchParams.set("id", pmcid.replace(/^PMC/i, ""));
  url.searchParams.set("retmode", "xml");
  return fetchText(url.toString());
}

interface PmcAwsArticleObjects {
  prefix: string;
  version: number;
  xmlUrl?: string;
  pdfUrl?: string;
  jsonUrl?: string;
}

export async function resolvePmcAwsArticleObjects(pmcid: string): Promise<PmcAwsArticleObjects | undefined> {
  const normalizedPmcid = normalizePmcid(pmcid);
  if (!normalizedPmcid) return undefined;

  const versionPrefixes = await listPmcAwsVersionPrefixes(normalizedPmcid);
  for (const prefix of versionPrefixes) {
    const keys = await listPmcAwsKeys(prefix);
    const xmlKey = keys.find((key) => key.toLowerCase().endsWith(".xml"));
    if (!xmlKey) continue;

    const versionMatch = prefix.match(/\.(\d+)\/$/);
    const version = versionMatch ? Number(versionMatch[1]) : 1;
    const pdfKey = keys.find((key) => key.toLowerCase().endsWith(".pdf"));
    const jsonKey = keys.find((key) => key.toLowerCase().endsWith(".json"));

    return {
      prefix,
      version,
      xmlUrl: `${PMC_AWS_BUCKET_URL}${xmlKey}`,
      pdfUrl: pdfKey ? `${PMC_AWS_BUCKET_URL}${pdfKey}` : undefined,
      jsonUrl: jsonKey ? `${PMC_AWS_BUCKET_URL}${jsonKey}` : undefined,
    };
  }

  return undefined;
}

async function listPmcAwsVersionPrefixes(pmcid: string): Promise<string[]> {
  const url = new URL(PMC_AWS_BUCKET_URL);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", `${pmcid}.`);
  url.searchParams.set("delimiter", "/");

  const xml = await fetchText(url.toString());
  const parsed = xmlParser.parse(xml) as {
    ListBucketResult?: {
      CommonPrefixes?: unknown | unknown[];
    };
  };

  return ensureArray(parsed.ListBucketResult?.CommonPrefixes)
    .map((entry) => normalizeText(textFromNode((entry as Record<string, unknown>).Prefix)))
    .filter(Boolean)
    .sort((a, b) => {
      const aVersion = Number(a.match(/\.(\d+)\/$/)?.[1] ?? 0);
      const bVersion = Number(b.match(/\.(\d+)\/$/)?.[1] ?? 0);
      return bVersion - aVersion;
    });
}

async function listPmcAwsKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const url = new URL(PMC_AWS_BUCKET_URL);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    if (continuationToken) {
      url.searchParams.set("continuation-token", continuationToken);
    }

    const xml = await fetchText(url.toString());
    const parsed = xmlParser.parse(xml) as {
      ListBucketResult?: {
        Contents?: unknown | unknown[];
        NextContinuationToken?: string;
      };
    };

    for (const content of ensureArray(parsed.ListBucketResult?.Contents)) {
      const key = normalizeText(textFromNode((content as Record<string, unknown>).Key));
      if (key) keys.push(key);
    }

    continuationToken = parsed.ListBucketResult?.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

export async function resolvePmcXmlUrl(pmcid: string): Promise<string | undefined> {
  const url = new URL(PMC_OA_SERVICE);
  url.searchParams.set("id", pmcid);
  const xml = await fetchText(url.toString());
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;

  const links = findNodesByKey(parsed, "link");
  for (const link of links) {
    if (typeof link !== "object" || !link) continue;
    const node = link as Record<string, unknown>;
    const format = String(node.format ?? "").toLowerCase();
    const href = String(node.href ?? "");
    if (!href) continue;
    if (format === "tgz" || format === "xml" || href.toLowerCase().endsWith(".nxml")) {
      return href;
    }
  }

  return undefined;
}

export async function resolvePmcPdfUrl(pmcid: string): Promise<string | undefined> {
  const awsObjects = await resolvePmcAwsArticleObjects(pmcid);
  if (awsObjects?.pdfUrl) {
    return awsObjects.pdfUrl;
  }

  const url = new URL(PMC_OA_SERVICE);
  url.searchParams.set("id", pmcid);
  const xml = await fetchText(url.toString());
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;

  const links = findNodesByKey(parsed, "link");
  for (const link of links) {
    if (typeof link !== "object" || !link) continue;
    const node = link as Record<string, unknown>;
    const format = String(node.format ?? "");
    const href = String(node.href ?? "");
    if (format.toLowerCase() === "pdf" && href) {
      return href;
    }
  }

  return undefined;
}

export function buildPubmedDiscoveryQuery(bucket: StudyDesignBucket, studyQuery: string): string {
  void bucket;
  return `(${studyQuery}) NOT retracted publication[pt]`;
}

async function fetchPmcidMapViaElink(pmids: string[]): Promise<Map<string, string>> {
  if (pmids.length === 0) return new Map<string, string>();
  const map = new Map<string, string>();

  for (let index = 0; index < pmids.length; index += 50) {
    const chunk = pmids.slice(index, index + 50);
    const url = new URL(`${EUTILS_BASE}/elink.fcgi`);
    url.searchParams.set("dbfrom", "pubmed");
    url.searchParams.set("db", "pmc");
    url.searchParams.set("linkname", "pubmed_pmc");
    url.searchParams.set("retmode", "xml");
    for (const pmid of chunk) {
      url.searchParams.append("id", pmid);
    }

    const xml = await fetchText(url.toString());
    const parsed = xmlParser.parse(xml) as {
      eLinkResult?: {
        LinkSet?: unknown | unknown[];
      };
    };

    for (const linkSet of ensureArray(parsed.eLinkResult?.LinkSet)) {
      const node = linkSet as Record<string, unknown>;
      const requestedPmid = normalizeText(textFromNode(node.IdList && (node.IdList as Record<string, unknown>).Id));
      const pmcIds = ensureArray(
        (((node.LinkSetDb as Record<string, unknown> | undefined)?.Link as Record<string, unknown> | undefined)?.Id) ??
        ensureArray(node.LinkSetDb).flatMap((entry) => ensureArray((entry as Record<string, unknown>).Link).map((link) => (link as Record<string, unknown>).Id)),
      )
        .map((value) => normalizePmcid(normalizeText(textFromNode(value))))
        .filter((value): value is string => Boolean(value));

      if (requestedPmid && pmcIds.length > 0) {
        map.set(requestedPmid, pmcIds[0]);
      }
    }
  }

  return map;
}

function normalizePmcid(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";

  const prefixedMatch = trimmed.match(/PMC\d+(?:\.\d+)?/);
  if (prefixedMatch) {
    return prefixedMatch[0];
  }

  const numericMatch = trimmed.match(/\d+(?:\.\d+)?/);
  if (numericMatch) {
    return `PMC${numericMatch[0]}`;
  }

  return "";
}

function normalizeNcbiDownloadUrl(url: string): string {
  if (url.startsWith("ftp://ftp.ncbi.nlm.nih.gov/")) {
    return url.replace("ftp://ftp.ncbi.nlm.nih.gov/", "https://ftp.ncbi.nlm.nih.gov/");
  }
  return url;
}

function extractFirstNxmlFromTgz(archive: Buffer): string {
  const tarBuffer = gunzipSync(archive);
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const sizeOctal = header.toString("utf8", 124, 136).replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeOctal || "0", 8);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;

    if (name.toLowerCase().endsWith(".nxml") || name.toLowerCase().endsWith(".xml")) {
      return tarBuffer.toString("utf8", contentStart, contentEnd);
    }

    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  throw new Error("PMC OA archive did not contain an XML/NXML article file.");
}

function findNodesByKey(root: unknown, targetKey: string): unknown[] {
  const results: unknown[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key === targetKey) {
        if (Array.isArray(value)) results.push(...value);
        else results.push(value);
      }
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(root);
  return results;
}

function textFromNode(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map((entry) => textFromNode(entry)).join(" ");
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    if ("#text" in record) {
      return textFromNode(record["#text"]);
    }
    return Object.entries(record)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, value]) => textFromNode(value))
      .join(" ");
  }
  return "";
}
