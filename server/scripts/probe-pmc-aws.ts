import { config as loadEnv } from "dotenv";
loadEnv();

import { resolvePmcAwsArticleObjects, fetchPmcXmlByPmcid } from "../services/parser-benchmark-source.service";
import { extractJatsGroundTruth } from "../services/jats-ground-truth.service";

const pmcid = process.argv[2];

if (!pmcid) {
  console.error("Usage: tsx server/scripts/probe-pmc-aws.ts <PMCID>");
  process.exit(1);
}

const objects = await resolvePmcAwsArticleObjects(pmcid);
console.log("objects", objects);

if (objects?.xmlUrl) {
  const xml = await fetchPmcXmlByPmcid(pmcid);
  const truth = extractJatsGroundTruth(xml);
  console.log({
    title: truth.title,
    journal: truth.journal,
    publisherName: truth.publisherName,
    sections: truth.sections.length,
    references: truth.references.length,
    figures: truth.figures.length,
    tables: truth.tables.length,
  });
}
