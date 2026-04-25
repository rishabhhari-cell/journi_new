import { XMLParser } from "fast-xml-parser";
import { normalizeSectionMatchKey } from "@shared/document-parse";
import type {
  GroundTruthFigure,
  GroundTruthReference,
  GroundTruthSection,
  GroundTruthTable,
  JatsGroundTruth,
} from "./parser-benchmark.types";

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

function pickNode(record: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
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

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function canonicalTitleFor(sourceTitle: string): string {
  const key = normalizeSectionMatchKey(sourceTitle);
  switch (key) {
    case "title":
      return "Title";
    case "abstract":
      return "Abstract";
    case "introduction":
      return "Introduction";
    case "methods":
      return "Search Strategy";
    case "results":
      return "Results & Synthesis";
    case "discussion":
      return "Discussion";
    case "limitations":
      return "Limitations";
    case "conclusions":
      return "Conclusions";
    case "references":
      return "References";
    case "acknowledgements":
      return "Acknowledgements";
    case "figures_and_tables":
      return "Figures and Tables";
    case "appendix":
      return "Appendix";
    default:
      return sourceTitle.trim() || "Content";
  }
}

function collectParagraphText(secNode: unknown): string {
  if (secNode == null || typeof secNode !== "object") return "";
  const node = secNode as Record<string, unknown>;
  const pieces: string[] = [];

  for (const paragraph of ensureArray(node.p)) {
    const text = normalizeWhitespace(textFromNode(paragraph));
    if (text) pieces.push(text);
  }

  for (const list of ensureArray(node.list)) {
    for (const item of ensureArray((list as Record<string, unknown>).listItem)) {
      const text = normalizeWhitespace(textFromNode(item));
      if (text) pieces.push(text);
    }
  }

  return pieces.join("\n\n").trim();
}

function collectAllDescendantText(secNode: unknown): string {
  if (secNode == null || typeof secNode !== "object") return "";
  const node = secNode as Record<string, unknown>;
  const pieces: string[] = [];

  for (const paragraph of ensureArray(node.p)) {
    const text = normalizeWhitespace(textFromNode(paragraph));
    if (text) pieces.push(text);
  }

  for (const list of ensureArray(node.list)) {
    for (const item of ensureArray((list as Record<string, unknown>).listItem)) {
      const text = normalizeWhitespace(textFromNode(item));
      if (text) pieces.push(text);
    }
  }

  for (const subSec of ensureArray(node.sec)) {
    const subText = collectAllDescendantText(subSec);
    if (subText) pieces.push(subText);
  }

  return pieces.join("\n\n").trim();
}

function collectSections(secNodes: unknown, sections: GroundTruthSection[], orderRef: { value: number }): void {
  for (const sec of ensureArray(secNodes)) {
    if (!sec || typeof sec !== "object") continue;
    const secNode = sec as Record<string, unknown>;
    const sourceTitle = normalizeWhitespace(textFromNode(secNode.title)) || "Content";
    // Use direct-children text; fall back to all-descendant text if section has no direct paragraphs
    const directText = collectParagraphText(secNode);
    const text = directText || collectAllDescendantText(secNode);
    sections.push({
      sourceTitle,
      canonicalTitle: canonicalTitleFor(sourceTitle),
      order: orderRef.value++,
      text,
      wordCount: countWords(text),
    });

    if (secNode.sec) {
      collectSections(secNode.sec, sections, orderRef);
    }
  }
}

function extractAuthors(articleMeta: Record<string, unknown>): string[] {
  const contribGroups = ensureArray(pickNode(articleMeta, "contrib-group", "contribGroup"));
  const authors: string[] = [];

  for (const contribGroup of contribGroups) {
    const contribs = ensureArray((contribGroup as Record<string, unknown>).contrib);
    for (const contrib of contribs) {
      const node = contrib as Record<string, unknown>;
      const contribType = String(pickNode(node, "contrib-type", "contribType") ?? "");
      if (contribType && contribType !== "author") continue;
      const nameNode = pickNode(node, "name") as Record<string, unknown> | undefined;
      const surname = normalizeWhitespace(textFromNode(pickNode(nameNode, "surname")));
      const givenNames = normalizeWhitespace(textFromNode(pickNode(nameNode, "given-names", "givenNames")));
      const collab = normalizeWhitespace(textFromNode(node.collab));
      const fullName = collab || [givenNames, surname].filter(Boolean).join(" ").trim();
      if (fullName) authors.push(fullName);
    }
  }

  return Array.from(new Set(authors));
}

function extractInstitutions(articleMeta: Record<string, unknown>): string[] {
  const affiliations = ensureArray(pickNode(articleMeta, "aff"))
    .map((aff) => normalizeWhitespace(textFromNode(aff)))
    .filter(Boolean);
  return Array.from(new Set(affiliations));
}

function extractReferences(backNode: Record<string, unknown> | undefined): GroundTruthReference[] {
  if (!backNode) return [];
  const refLists = ensureArray(backNode.refList);
  const fallbackRefLists = ensureArray(pickNode(backNode, "ref-list", "refList"));
  const refs: GroundTruthReference[] = [];

  for (const refList of (refLists.length > 0 ? refLists : fallbackRefLists)) {
    for (const ref of ensureArray((refList as Record<string, unknown>).ref)) {
      const citationNode =
        pickNode(ref as Record<string, unknown>, "element-citation", "elementCitation") ||
        pickNode(ref as Record<string, unknown>, "mixed-citation", "mixedCitation") ||
        (ref as Record<string, unknown>).citation;
      const rawText = normalizeWhitespace(textFromNode(citationNode || ref));
      if (!rawText) continue;
      const title = normalizeWhitespace(textFromNode(pickNode(citationNode as Record<string, unknown> | undefined, "article-title", "articleTitle")));
      const yearText = normalizeWhitespace(textFromNode((citationNode as Record<string, unknown> | undefined)?.year));
      const year = /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;
      const doi = normalizeWhitespace(
        textFromNode(
          ensureArray(pickNode(citationNode as Record<string, unknown> | undefined, "pub-id", "pubId")).find((pubId) => {
            return typeof pubId === "object" && String(pickNode(pubId as Record<string, unknown>, "pub-id-type", "pubIdType")) === "doi";
          }),
        ),
      ) || rawText.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/)?.[0];

      refs.push({
        rawText,
        title: title || undefined,
        year,
        doi: doi || undefined,
      });
    }
  }

  return refs;
}

function extractFigures(bodyNode: Record<string, unknown> | undefined): GroundTruthFigure[] {
  if (!bodyNode) return [];
  const figures: GroundTruthFigure[] = [];

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const objectNode = node as Record<string, unknown>;
    for (const fig of ensureArray(objectNode.fig)) {
      const figNode = fig as Record<string, unknown>;
      figures.push({
        label: normalizeWhitespace(textFromNode(figNode.label)) || undefined,
        caption: normalizeWhitespace(textFromNode(figNode.caption)) || undefined,
      });
    }
    for (const value of Object.values(objectNode)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };

  walk(bodyNode);
  return figures;
}

function extractTables(bodyNode: Record<string, unknown> | undefined): GroundTruthTable[] {
  if (!bodyNode) return [];
  const tables: GroundTruthTable[] = [];

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const objectNode = node as Record<string, unknown>;
    for (const tableWrap of ensureArray(objectNode.tableWrap)) {
      const tableNode = tableWrap as Record<string, unknown>;
      tables.push({
        label: normalizeWhitespace(textFromNode(tableNode.label)) || undefined,
        caption: normalizeWhitespace(textFromNode(tableNode.caption)) || undefined,
      });
    }
    for (const value of Object.values(objectNode)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };

  walk(bodyNode);
  return tables;
}

export function extractJatsGroundTruth(xml: string): JatsGroundTruth {
  const parsed = xmlParser.parse(xml);
  const article = parsed.article as Record<string, unknown> | undefined;
  if (!article) {
    throw new Error("JATS XML did not contain an article root node.");
  }

  const front = article.front as Record<string, unknown> | undefined;
  const articleMeta = pickNode(front, "article-meta", "articleMeta") as Record<string, unknown> | undefined;
  const journalMeta = pickNode(front, "journal-meta", "journalMeta") as Record<string, unknown> | undefined;
  const body = article.body as Record<string, unknown> | undefined;
  const back = article.back as Record<string, unknown> | undefined;

  const title = normalizeWhitespace(
    textFromNode(
      pickNode(
        pickNode(articleMeta, "title-group", "titleGroup") as Record<string, unknown> | undefined,
        "article-title",
        "articleTitle",
      ),
    ),
  );
  const abstractText = normalizeWhitespace(textFromNode(articleMeta?.abstract));
  const pmid = normalizeWhitespace(
    textFromNode(
      ensureArray(pickNode(articleMeta, "article-id", "articleId")).find((item) => {
        return typeof item === "object" && String(pickNode(item as Record<string, unknown>, "pub-id-type", "pubIdType")) === "pmid";
      }),
    ),
  ) || undefined;
  const pmcid = normalizeWhitespace(
    textFromNode(
      ensureArray(pickNode(articleMeta, "article-id", "articleId")).find((item) => {
        return typeof item === "object" && String(pickNode(item as Record<string, unknown>, "pub-id-type", "pubIdType")) === "pmcid";
      }),
    ),
  ) || undefined;
  const doi = normalizeWhitespace(
    textFromNode(
      ensureArray(pickNode(articleMeta, "article-id", "articleId")).find((item) => {
        return typeof item === "object" && String(pickNode(item as Record<string, unknown>, "pub-id-type", "pubIdType")) === "doi";
      }),
    ),
  ) || undefined;
  const journal = normalizeWhitespace(
    textFromNode(
      pickNode(
        pickNode(journalMeta, "journal-title-group", "journalTitleGroup") as Record<string, unknown> | undefined,
        "journal-title",
        "journalTitle",
      ),
    ),
  ) || undefined;
  const publisherName = normalizeWhitespace(
    textFromNode(
      pickNode(
        pickNode(journalMeta, "publisher") as Record<string, unknown> | undefined,
        "publisher-name",
        "publisherName",
      ),
    ),
  ) || undefined;

  const sections: GroundTruthSection[] = [];
  const orderRef = { value: 0 };

  sections.push({
    sourceTitle: "Title",
    canonicalTitle: "Title",
    order: orderRef.value++,
    text: title,
    wordCount: countWords(title),
  });

  if (abstractText) {
    sections.push({
      sourceTitle: "Abstract",
      canonicalTitle: "Abstract",
      order: orderRef.value++,
      text: abstractText,
      wordCount: countWords(abstractText),
    });
  }

  if (body?.sec) {
    collectSections(body.sec, sections, orderRef);
  } else if (body) {
    const fallbackBodyText = normalizeWhitespace(textFromNode(body));
    if (fallbackBodyText) {
      sections.push({
        sourceTitle: "Content",
        canonicalTitle: "Content",
        order: orderRef.value++,
        text: fallbackBodyText,
        wordCount: countWords(fallbackBodyText),
      });
    }
  }

  const references = extractReferences(back);
  if (references.length > 0) {
    const referenceText = references.map((ref) => ref.rawText).join("\n");
    sections.push({
      sourceTitle: "References",
      canonicalTitle: "References",
      order: orderRef.value++,
      text: referenceText,
      wordCount: countWords(referenceText),
    });
  }

  const figures = extractFigures(body);
  const tables = extractTables(body);

  return {
    pmid,
    pmcid,
    doi,
    journal,
    publisherName,
    title,
    abstractText,
    authors: articleMeta ? extractAuthors(articleMeta) : [],
    institutions: articleMeta ? extractInstitutions(articleMeta) : [],
    sections,
    references,
    figures,
    tables,
    publicationTypesRaw: [],
  };
}

export function renderGroundTruthHtml(truth: JatsGroundTruth): string {
  const parts: string[] = [];
  for (const section of truth.sections) {
    if (section.canonicalTitle === "Title") {
      parts.push(`<h1>${escapeHtml(section.text)}</h1>`);
      continue;
    }
    parts.push(`<h2>${escapeHtml(section.canonicalTitle)}</h2>`);
    for (const paragraph of section.text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)) {
      parts.push(`<p>${escapeHtml(paragraph)}</p>`);
    }
  }

  if (truth.figures.length > 0 || truth.tables.length > 0) {
    parts.push("<h2>Figures and Tables</h2>");
    truth.figures.forEach((figure, index) => {
      const label = figure.label || `Figure ${index + 1}`;
      const caption = figure.caption || "";
      parts.push(`<p><strong>${escapeHtml(label)}</strong>${caption ? `: ${escapeHtml(caption)}` : ""}</p>`);
    });
    truth.tables.forEach((table, index) => {
      const label = table.label || `Table ${index + 1}`;
      const caption = table.caption || "";
      parts.push(`<p><strong>${escapeHtml(label)}</strong>${caption ? `: ${escapeHtml(caption)}` : ""}</p>`);
    });
  }

  return parts.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
