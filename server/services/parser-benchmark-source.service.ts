import { XMLParser } from "fast-xml-parser";
import type { StudyDesignBucket } from "./parser-benchmark.types";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PMC_ID_CONVERTER = "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/";
const PMC_OA_SERVICE = "https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi";

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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/xml, text/xml, application/json, text/plain",
      "User-Agent": "Journi Parser Benchmark/1.0",
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`);
  }

  return response.text();
}

export interface PubmedArticleRecord {
  pmid: string;
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

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "Journi Parser Benchmark/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PubMed esearch failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const payload = await response.json() as {
    esearchresult: { count: string; idlist: string[] };
  };

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
  const url = new URL(PMC_ID_CONVERTER);
  url.searchParams.set("ids", pmids.join(","));
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "Journi Parser Benchmark/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PMC id conversion failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const payload = await response.json() as {
    records?: Array<{ pmid?: string; pmcid?: string }>;
  };
  const map = new Map<string, string>();
  for (const record of payload.records ?? []) {
    if (record.pmid && record.pmcid) {
      map.set(record.pmid, record.pmcid.startsWith("PMC") ? record.pmcid : `PMC${record.pmcid}`);
    }
  }
  return map;
}

export async function fetchPmcXmlByPmcid(pmcid: string): Promise<string> {
  const url = new URL(`${EUTILS_BASE}/efetch.fcgi`);
  url.searchParams.set("db", "pmc");
  url.searchParams.set("id", pmcid);
  url.searchParams.set("retmode", "xml");
  return fetchText(url.toString());
}

export async function resolvePmcPdfUrl(pmcid: string): Promise<string | undefined> {
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
  return `${studyQuery} AND ("pubmed pmc open access"[filter] OR author manuscript[filter])`;
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
    return Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, value]) => textFromNode(value))
      .join(" ");
  }
  return "";
}
