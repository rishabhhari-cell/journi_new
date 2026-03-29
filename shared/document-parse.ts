import { countWordsFromHtml } from "./word-count";

export type ParseDiagnosticLevel = "info" | "warning" | "error";

export interface ParseDiagnostic {
  level: ParseDiagnosticLevel;
  code: string;
  message: string;
}

export interface ParsedCitation {
  authors: string[];
  title: string;
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  type: "article" | "book" | "website" | "conference";
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedSection {
  title: string;
  content: string;
  order: number;
  wordCount: number;
  sourceTitle?: string;
}

export interface ParsedManuscript {
  fileTitle: string;
  sections: ParsedSection[];
  citations: ParsedCitation[];
  diagnostics: ParseDiagnostic[];
  totalWordCount: number;
}

export interface RawParsedDocument {
  fileTitle: string;
  format: "docx" | "pdf" | "image";
  html?: string;
  text?: string;
  imageDataUrl?: string;
  references?: string[];
  diagnostics?: ParseDiagnostic[];
}

interface IntermediateSection {
  title: string;
  content: string;
}

const CANONICAL_ORDER = [
  "Title",
  "Abstract",
  "Introduction",
  "Search Strategy",
  "Results & Synthesis",
  "Discussion",
  "Limitations",
  "Conclusions",
  "References",
];

const CANONICAL_ALIASES: Array<[string, RegExp]> = [
  ["Title", /^(title|title page)$/i],
  ["Abstract", /^(abstract|summary)$/i],
  ["Introduction", /^(introduction|background)$/i],
  ["Search Strategy", /^(search strategy|sources of data|method|methods|methodology)$/i],
  ["Results & Synthesis", /^(results|results and synthesis|results & synthesis|benefits|findings)$/i],
  ["Discussion", /^(discussion|drawbacks|analysis)$/i],
  ["Limitations", /^(limitations|constraints)$/i],
  ["Conclusions", /^(conclusion|conclusions|final remarks)$/i],
  ["References", /^(references|bibliography)$/i],
];

function normalizeHeading(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}\s&/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function mapToCanonical(title: string): string {
  const cleaned = normalizeHeading(title);
  for (const [canonical, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(cleaned)) return canonical;
  }
  return cleaned ? toTitleCase(cleaned) : "Content";
}

function ensureParagraph(content: string): string {
  const trimmed = (content || "").trim();
  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return `<p>${trimmed}</p>`;
}

function sanitizeReferenceLine(line: string): string {
  return line
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function parseCitationsFromReferences(lines: string[]): ParsedCitation[] {
  const citations: ParsedCitation[] = [];

  for (const rawLine of lines) {
    const raw = sanitizeReferenceLine(rawLine);
    if (!raw) continue;

    const doiMatch = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
    const urlMatch = raw.match(/https?:\/\/[^\s)]+/i);
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
    const sentenceParts = raw.split(".").map((part) => part.trim()).filter(Boolean);

    let title = sentenceParts.length > 1 ? sentenceParts[1] : sentenceParts[0];
    if (!title) title = raw;
    const authorPart = sentenceParts[0] || "";
    const authors = authorPart
      .split(/,| and /i)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 5);
    const journal = sentenceParts.length > 2 ? sentenceParts[2] : undefined;

    citations.push({
      authors: authors.length > 0 ? authors : ["Unknown"],
      title,
      year: yearMatch ? Number(yearMatch[0]) : new Date().getFullYear(),
      journal,
      doi: doiMatch ? doiMatch[0] : undefined,
      url: urlMatch ? urlMatch[0] : undefined,
      type: journal ? "article" : urlMatch ? "website" : "conference",
      metadata: { raw },
    });
  }

  return citations;
}

function mergeIntoCanonicalOrder(
  sections: IntermediateSection[],
  fileTitle: string,
): IntermediateSection[] {
  const map = new Map<string, IntermediateSection>();

  for (const section of sections) {
    const canonicalTitle = mapToCanonical(section.title);
    const existing = map.get(canonicalTitle);
    if (existing) {
      existing.content = `${existing.content}\n${section.content}`.trim();
      continue;
    }
    map.set(canonicalTitle, {
      title: canonicalTitle,
      content: ensureParagraph(section.content),
    });
  }

  if (!map.has("Title")) {
    map.set("Title", { title: "Title", content: `<p>${fileTitle}</p>` });
  }

  const ordered: IntermediateSection[] = [];
  for (const canonical of CANONICAL_ORDER) {
    const entry = map.get(canonical);
    if (entry) {
      ordered.push(entry);
      map.delete(canonical);
    }
  }

  for (const entry of map.values()) {
    ordered.push(entry);
  }

  return ordered;
}

function isBoldOnlyHeading(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== "p") return false;
  const text = (node.textContent || "").trim();
  if (!text || text.length > 80) return false;

  // Paragraph whose entire content is a single <strong> or <b> element
  const children = Array.from(node.children);
  const soleChild = children.length === 1 ? children[0] : null;
  const isBold =
    soleChild !== null &&
    (soleChild.tagName.toLowerCase() === "strong" || soleChild.tagName.toLowerCase() === "b") &&
    (soleChild.textContent || "").trim() === text;

  if (!isBold) return false;

  // Only treat as heading if text matches a known canonical section name or looks like ALL-CAPS heading
  for (const [, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(text)) return true;
  }
  return /^[A-Z][A-Z\s&/\-0-9]{2,}$/.test(text);
}

function parseSectionsFromHtml(html: string): IntermediateSection[] {
  if (typeof DOMParser === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return [];

  const sections: IntermediateSection[] = [];
  let currentTitle = "";
  let currentContent = "";

  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || isBoldOnlyHeading(node)) {
      if (currentTitle || currentContent.trim()) {
        sections.push({
          title: currentTitle || "Content",
          content: ensureParagraph(currentContent.trim()),
        });
      }
      currentTitle = normalizeHeading(node.textContent || "") || "Content";
      currentContent = "";
    } else {
      currentContent += node.outerHTML;
    }
  }

  if (currentTitle || currentContent.trim()) {
    sections.push({
      title: currentTitle || "Content",
      content: ensureParagraph(currentContent.trim()),
    });
  }

  if (sections.length === 0 && html.trim()) {
    sections.push({ title: "Content", content: ensureParagraph(html) });
  }

  return sections;
}

function parseSectionsFromText(text: string): IntermediateSection[] {
  const lines = text.split(/\r?\n/);
  const sections: IntermediateSection[] = [];
  let currentTitle = "";
  let buffer: string[] = [];

  const headingCandidates = new Set(
    [
      ...CANONICAL_ORDER,
      "methods",
      "methodology",
      "sources of data",
      "benefits",
      "drawbacks",
      "summary",
      "content",
    ].map((value) => value.toLowerCase()),
  );

  const flush = () => {
    if (!currentTitle && buffer.length === 0) return;
    const content = buffer
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${line}</p>`)
      .join("");
    sections.push({
      title: currentTitle || "Content",
      content: content || "<p></p>",
    });
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      buffer.push("");
      continue;
    }

    const normalized = normalizeHeading(trimmed).toLowerCase();
    const isKnownHeading = headingCandidates.has(normalized);
    const looksLikeHeading =
      normalized.length <= 80 &&
      (isKnownHeading || (/^[A-Z0-9\s&/-]+$/.test(trimmed) && trimmed.length > 2));

    if (looksLikeHeading) {
      flush();
      currentTitle = toTitleCase(normalized);
      continue;
    }

    buffer.push(trimmed);
  }

  flush();
  return sections;
}

function dedupeCitations(citations: ParsedCitation[]): ParsedCitation[] {
  const seen = new Set<string>();
  const deduped: ParsedCitation[] = [];
  for (const citation of citations) {
    const key = (citation.doi || citation.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(citation);
  }
  return deduped;
}

function extractReferenceLines(contentHtml: string): string[] {
  const fromListItems = Array.from(contentHtml.matchAll(/<li>([\s\S]*?)<\/li>/gi)).map((match) => match[1]);
  if (fromListItems.length > 0) return fromListItems;

  const plain = contentHtml
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const numbered = Array.from(
    plain.matchAll(/(?:^|\n)\s*(?:\[?\d+\]?[\.\)]?)\s+([\s\S]*?)(?=(?:\n\s*(?:\[?\d+\]?[\.\)]?)\s+)|$)/g),
  )
    .map((match) => match[1].trim())
    .filter(Boolean);

  if (numbered.length > 0) return numbered;

  return plain.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

export function parseRawDocument(raw: RawParsedDocument): ParsedManuscript {
  const diagnostics = [...(raw.diagnostics || [])];
  const fileTitle = raw.fileTitle || "Imported Manuscript";

  // Image files are embedded directly as a figure section
  if (raw.format === "image" && raw.imageDataUrl) {
    const imgHtml = `<p><img src="${raw.imageDataUrl}" alt="${fileTitle}" style="max-width:100%" /></p>`;
    return {
      fileTitle,
      sections: [
        {
          title: "Figure",
          content: imgHtml,
          order: 0,
          wordCount: 0,
          sourceTitle: "Figure",
        },
      ],
      citations: [],
      diagnostics,
      totalWordCount: 0,
    };
  }

  const sectionsFromHtml = raw.html ? parseSectionsFromHtml(raw.html) : [];
  const sectionsFromText = raw.text ? parseSectionsFromText(raw.text) : [];
  const baseSections = sectionsFromHtml.length > 0 ? sectionsFromHtml : sectionsFromText;

  if (baseSections.length === 0) {
    diagnostics.push({
      level: "warning",
      code: "NO_SECTIONS_DETECTED",
      message: "No section headings were detected. Imported content was added as a single section.",
    });
  }

  const canonicalSections = mergeIntoCanonicalOrder(
    baseSections.length > 0 ? baseSections : [{ title: "Content", content: "<p></p>" }],
    fileTitle,
  );

  if (raw.references && raw.references.length > 0) {
    const refsHtml = `<ol>${raw.references.map((line) => `<li>${line}</li>`).join("")}</ol>`;
    const existingRef = canonicalSections.find((section) => section.title === "References");
    if (existingRef) {
      existingRef.content = refsHtml;
    } else {
      canonicalSections.push({ title: "References", content: refsHtml });
    }
  }

  const referencesSection = canonicalSections.find((section) => section.title === "References");
  const referencesLines = referencesSection ? extractReferenceLines(referencesSection.content) : [];

  const citations = dedupeCitations(parseCitationsFromReferences(referencesLines));

  const sections: ParsedSection[] = canonicalSections.map((section, index) => ({
    title: section.title,
    content: ensureParagraph(section.content),
    order: index,
    wordCount: countWordsFromHtml(section.content),
    sourceTitle: section.title,
  }));

  return {
    fileTitle,
    sections,
    citations,
    diagnostics,
    totalWordCount: sections.reduce((sum, section) => sum + section.wordCount, 0),
  };
}
