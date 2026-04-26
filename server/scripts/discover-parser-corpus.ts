import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import {
  DEFAULT_DISCOVERY_BATCH_SIZE,
  DISCOVERY_PROGRESS_PATH,
  DISCOVERY_OVERSAMPLE_MULTIPLIER,
  MANIFEST_PATH,
  PDF_DIR,
  PUBMED_STUDY_QUERY_BY_BUCKET,
  PUBLISHER_BUCKETS,
  STUDY_BUCKET_TARGETS,
  STUDY_DESIGN_BUCKETS,
  XML_DIR,
} from "../services/parser-benchmark.constants";
import {
  buildPubmedDiscoveryQuery,
  fetchPmcidMap,
  fetchPubmedArticles,
  searchPubmedIds,
} from "../services/parser-benchmark-source.service";
import type { CorpusManifestRow } from "../services/parser-benchmark.types";
import { matchPublisherBucket, normalizePublicationTypes } from "../services/publication-type-normalize.service";
import { ensureDir, fileExists, readJson, readJsonl, slugify, writeJson, writeJsonl } from "../services/parser-benchmark.utils";

const MAX_RESULTS_PER_STUDY_BUCKET = Number(process.env.BENCHMARK_DISCOVERY_MAX_RESULTS ?? 5000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCIMAGO_CSV_PATH = path.join(__dirname, "data", "scimago.csv");

interface DiscoveryProgressState {
  studyBuckets: Partial<Record<string, { retstart: number }>>;
}

function makeArtifactPath(rootDir: string, basename: string, ext: string): string {
  return path.join(rootDir, `${slugify(basename)}.${ext}`);
}

async function main() {
  await ensureDir(XML_DIR);
  await ensureDir(PDF_DIR);

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const manifestByPmid = new Map(manifest.map((row) => [row.pmid, row]));
  const publisherByJournalTitle = await loadScimagoPublisherMap();
  const progress = await readDiscoveryProgress();
  console.log(`Loaded ${publisherByJournalTitle.size} local journal publisher mappings.`);

  for (const studyBucket of STUDY_DESIGN_BUCKETS) {
    const requiredPerPublisher = Math.ceil(STUDY_BUCKET_TARGETS[studyBucket] * DISCOVERY_OVERSAMPLE_MULTIPLIER);
    const query = buildPubmedDiscoveryQuery(studyBucket, PUBMED_STUDY_QUERY_BY_BUCKET[studyBucket]);
    console.log(`Discovering ${studyBucket} candidates with query: ${query}`);
    let discoveredForBucket = 0;

    let retstart = progress.studyBuckets[studyBucket]?.retstart ?? 0;
    if (retstart > 0) {
      console.log(`Resuming ${studyBucket} from PubMed offset ${retstart}.`);
    }
    while (retstart < MAX_RESULTS_PER_STUDY_BUCKET) {
      const counts = countRowsByPublisherAndStudy(Array.from(manifestByPmid.values()), studyBucket);
      if (PUBLISHER_BUCKETS.every((publisher) => (counts.get(publisher) ?? 0) >= requiredPerPublisher)) {
        break;
      }

      const { ids, totalCount } = await searchPubmedIds(query, retstart, DEFAULT_DISCOVERY_BATCH_SIZE);
      if (retstart === 0) {
        console.log(`PubMed returned ${totalCount} candidate ids for ${studyBucket}.`);
      }
      if (ids.length === 0) {
        console.log(`No more PubMed ids for ${studyBucket} at offset ${retstart}.`);
        break;
      }
      retstart += ids.length;
      progress.studyBuckets[studyBucket] = { retstart };

      const articles = await fetchPubmedArticles(ids);
      let addedThisPage = 0;
      let skippedExisting = 0;
      let skippedRetracted = 0;
      let skippedNoPmcid = 0;
      let skippedPublisher = 0;
      const pmcidMap = new Map(
        articles
          .filter((article) => article.pmcid)
          .map((article) => [article.pmid, article.pmcid as string]),
      );
      const missingPmids = articles
        .filter((article) => !article.pmcid)
        .map((article) => article.pmid);
      if (missingPmids.length > 0) {
        const fallbackMap = await fetchPmcidMap(missingPmids);
        for (const [pmid, pmcid] of fallbackMap.entries()) {
          pmcidMap.set(pmid, pmcid);
        }
      }
      console.log(
        `${studyBucket}: fetched ${articles.length} PubMed articles, ${articles.filter((article) => article.pmcid).length} had direct PMCID values, ${pmcidMap.size} total had PMCID mappings in this page.`,
      );

      for (const article of articles) {
        if (manifestByPmid.has(article.pmid)) {
          skippedExisting += 1;
          continue;
        }
        if (article.isRetracted) {
          skippedRetracted += 1;
          continue;
        }

        const pmcid = pmcidMap.get(article.pmid);
        if (!pmcid) {
          skippedNoPmcid += 1;
          continue;
        }

        const publisherRaw = findPublisherForJournal(article.journal, publisherByJournalTitle);
        const publisherMatch = matchPublisherBucket(publisherRaw, article.journal);
        if (!publisherMatch.bucket) {
          skippedPublisher += 1;
          continue;
        }

        const normalizedStudy = normalizePublicationTypes(
          article.publicationTypesRaw,
          article.title,
          article.abstractText,
        );

        const row: CorpusManifestRow = {
          pmid: article.pmid,
          pmcid,
          doi: article.doi,
          title: article.title,
          abstractText: article.abstractText,
          journal: article.journal,
          publisherRaw: publisherRaw ?? article.journal,
          publisherBucket: publisherMatch.bucket,
          publisherConfidence: publisherMatch.confidence,
          publicationYear: article.publicationYear,
          publicationTypesRaw: article.publicationTypesRaw,
          studyDesignBucket: normalizedStudy.bucket,
          studyDesignConfidence: normalizedStudy.confidence,
          isRetracted: article.isRetracted,
          licenseCode: undefined,
          xmlUrl: `pmc:${pmcid}`,
          pdfUrl: undefined,
          sourceQuery: query,
          notes: [...normalizedStudy.reasons],
          selected: false,
          xml: {
            status: "pending",
            path: makeArtifactPath(XML_DIR, pmcid, "xml"),
            sourceUrl: `pmc:${pmcid}`,
          },
          pdf: {
            status: "pending",
            path: makeArtifactPath(PDF_DIR, pmcid, "pdf"),
          },
          docx: { status: "pending" },
          truth: { status: "pending" },
        };

        manifestByPmid.set(article.pmid, row);
        discoveredForBucket += 1;
        addedThisPage += 1;
      }

      await writeJsonl(MANIFEST_PATH, Array.from(manifestByPmid.values()));
      await writeJson(DISCOVERY_PROGRESS_PATH, progress);
      const bucketTotal = Array.from(manifestByPmid.values()).filter((row) => row.studyDesignBucket === studyBucket).length;
      console.log(
        `${studyBucket}: added ${addedThisPage} rows this page; bucket total ${bucketTotal}; skips existing=${skippedExisting}, retracted=${skippedRetracted}, noPmcid=${skippedNoPmcid}, publisher=${skippedPublisher}.`,
      );
    }

    await writeJson(DISCOVERY_PROGRESS_PATH, progress);
    console.log(`Finished ${studyBucket}: discovered ${discoveredForBucket} rows this run.`);
  }

  await writeJsonl(MANIFEST_PATH, Array.from(manifestByPmid.values()));
  console.log(`Discovery complete. Manifest rows: ${manifestByPmid.size}`);
}

function countRowsByPublisherAndStudy(rows: CorpusManifestRow[], studyBucket: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.studyDesignBucket !== studyBucket || !row.publisherBucket) continue;
    counts.set(row.publisherBucket, (counts.get(row.publisherBucket) ?? 0) + 1);
  }
  return counts;
}

async function loadScimagoPublisherMap(): Promise<Map<string, string>> {
  const raw = await fs.readFile(SCIMAGO_CSV_PATH, "utf8");
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = splitSemicolonCsv(lines[0]);
  const titleIndex = header.findIndex((column) => column === "Title");
  const publisherIndex = header.findIndex((column) => column === "Publisher");
  const map = new Map<string, string>();

  for (const line of lines.slice(1)) {
    const columns = splitSemicolonCsv(line);
    const title = columns[titleIndex];
    const publisher = columns[publisherIndex];
    if (!title || !publisher) continue;
    const key = normalizeJournalKey(title);
    if (!key || map.has(key)) continue;
    map.set(key, publisher);
  }

  return map;
}

function splitSemicolonCsv(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      const next = line[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ";" && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeJournalKey(value: string | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function findPublisherForJournal(
  journal: string | undefined,
  publisherByJournalTitle: Map<string, string>,
): string | undefined {
  if (!journal) return undefined;
  return publisherByJournalTitle.get(normalizeJournalKey(journal));
}

async function readDiscoveryProgress(): Promise<DiscoveryProgressState> {
  if (!(await fileExists(DISCOVERY_PROGRESS_PATH))) {
    return { studyBuckets: {} };
  }

  try {
    const value = await readJson<DiscoveryProgressState>(DISCOVERY_PROGRESS_PATH);
    return {
      studyBuckets: value.studyBuckets ?? {},
    };
  } catch {
    return { studyBuckets: {} };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
