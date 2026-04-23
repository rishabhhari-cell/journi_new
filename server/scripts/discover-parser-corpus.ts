import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_DISCOVERY_BATCH_SIZE,
  DISCOVERY_OVERSAMPLE_MULTIPLIER,
  MANIFEST_PATH,
  PDF_DIR,
  PUBMED_STUDY_QUERY_BY_BUCKET,
  PUBLISHER_BUCKETS,
  STUDY_BUCKET_TARGETS,
  STUDY_DESIGN_BUCKETS,
  XML_DIR,
} from "../services/parser-benchmark.constants";
import { extractJatsGroundTruth } from "../services/jats-ground-truth.service";
import {
  buildPubmedDiscoveryQuery,
  fetchPmcXmlByPmcid,
  fetchPmcidMap,
  fetchPubmedArticles,
  resolvePmcAwsArticleObjects,
  resolvePmcPdfUrl,
  searchPubmedIds,
} from "../services/parser-benchmark-source.service";
import type { CorpusManifestRow } from "../services/parser-benchmark.types";
import { matchPublisherBucket, normalizePublicationTypes } from "../services/publication-type-normalize.service";
import { ensureDir, readJsonl, sha256Buffer, slugify, writeJsonl } from "../services/parser-benchmark.utils";

const MAX_RESULTS_PER_STUDY_BUCKET = Number(process.env.BENCHMARK_DISCOVERY_MAX_RESULTS ?? 5000);
const XML_FETCH_CONCURRENCY = Number(process.env.BENCHMARK_XML_DISCOVERY_CONCURRENCY ?? 1);

function makeArtifactPath(rootDir: string, basename: string, ext: string): string {
  return path.join(rootDir, `${slugify(basename)}.${ext}`);
}

async function main() {
  await ensureDir(XML_DIR);
  await ensureDir(PDF_DIR);

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const manifestByPmid = new Map(manifest.map((row) => [row.pmid, row]));

  for (const studyBucket of STUDY_DESIGN_BUCKETS) {
    const requiredPerPublisher = Math.ceil(STUDY_BUCKET_TARGETS[studyBucket] * DISCOVERY_OVERSAMPLE_MULTIPLIER);
    const query = buildPubmedDiscoveryQuery(studyBucket, PUBMED_STUDY_QUERY_BY_BUCKET[studyBucket]);
    console.log(`Discovering ${studyBucket} candidates with query: ${query}`);
    let discoveredForBucket = 0;

    let retstart = 0;
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

      const articles = await fetchPubmedArticles(ids);
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

      for (let index = 0; index < articles.length; index += XML_FETCH_CONCURRENCY) {
        const slice = articles.slice(index, index + XML_FETCH_CONCURRENCY);
        await Promise.all(
          slice.map(async (article) => {
            if (manifestByPmid.has(article.pmid)) return;
            if (article.isRetracted) return;

            const pmcid = pmcidMap.get(article.pmid);
            if (!pmcid) return;

            try {
              const xml = await fetchPmcXmlByPmcid(pmcid);
              const truth = extractJatsGroundTruth(xml);
              const publisherMatch = matchPublisherBucket(truth.publisherName, article.journal);
              if (!publisherMatch.bucket) return;

              const normalizedStudy = normalizePublicationTypes(
                article.publicationTypesRaw,
                article.title,
                article.abstractText,
              );
              const xmlPath = makeArtifactPath(XML_DIR, pmcid, "xml");
              await fs.writeFile(xmlPath, xml, "utf8");
              const xmlBuffer = Buffer.from(xml, "utf8");

              let pdfUrl: string | undefined;
              try {
                pdfUrl = (await resolvePmcAwsArticleObjects(pmcid))?.pdfUrl ?? await resolvePmcPdfUrl(pmcid);
              } catch (error) {
                pdfUrl = undefined;
                console.warn(`PDF URL lookup failed for ${pmcid}: ${(error as Error).message}`);
              }

              const row: CorpusManifestRow = {
                pmid: article.pmid,
                pmcid,
                doi: article.doi ?? truth.doi,
                title: article.title || truth.title,
                abstractText: article.abstractText || truth.abstractText,
                journal: article.journal || truth.journal,
                publisherRaw: truth.publisherName,
                publisherBucket: publisherMatch.bucket,
                publisherConfidence: publisherMatch.confidence,
                publicationYear: article.publicationYear,
                publicationTypesRaw: article.publicationTypesRaw,
                studyDesignBucket: normalizedStudy.bucket,
                studyDesignConfidence: normalizedStudy.confidence,
                isRetracted: article.isRetracted,
                licenseCode: undefined,
                xmlUrl: `pmc-efetch:${pmcid}`,
                pdfUrl,
                sourceQuery: query,
                notes: [...normalizedStudy.reasons],
                selected: false,
                xml: {
                  status: "ready",
                  path: xmlPath,
                  sha256: sha256Buffer(xmlBuffer),
                  sourceUrl: `pmc-efetch:${pmcid}`,
                  bytes: xmlBuffer.byteLength,
                },
                pdf: {
                  status: pdfUrl ? "pending" : "missing",
                  path: pdfUrl ? makeArtifactPath(PDF_DIR, pmcid, "pdf") : undefined,
                  sourceUrl: pdfUrl,
                },
                docx: { status: "pending" },
                truth: { status: "pending" },
              };

              manifestByPmid.set(article.pmid, row);
              discoveredForBucket += 1;
              console.log(`Discovered ${article.pmid} (${publisherMatch.bucket}, ${normalizedStudy.bucket})`);
            } catch (error) {
              const message = (error as Error).message;
              if (
                message.includes("JATS XML did not contain an article root node") ||
                message.includes("<eFetchResult>") ||
                message.includes("PMC OA archive did not contain")
              ) {
                console.log(`Skipped PMID ${article.pmid}: no usable JATS XML source.`);
              } else {
                console.warn(`Discovery failed for PMID ${article.pmid}: ${message}`);
              }
            }
          }),
        );
      }

      await writeJsonl(MANIFEST_PATH, Array.from(manifestByPmid.values()));
    }

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
