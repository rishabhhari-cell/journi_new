import mammoth from "mammoth";
import type { ParseDiagnostic, ParsedBlock, ParsedBoundingBox, ParsedFigure, ParsedTable, RawParsedDocument } from "../../shared/document-parse";
import { parseDocumentWithLLM } from "./llm.service";

export interface ParseUploadInput {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  hellip: "\u2026",
};

function extname(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function sanitizeTitle(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  return withoutExt.trim() || "Imported Manuscript";
}

function normalizeText(value: string): string {
  return value
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, token: string) => {
    if (token[0] === "#") {
      const isHex = token[1]?.toLowerCase() === "x";
      const raw = isHex ? token.slice(2) : token.slice(1);
      const codePoint = Number.parseInt(raw, isHex ? 16 : 10);
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return entity;
        }
      }
      return entity;
    }

    return HTML_ENTITY_MAP[token.toLowerCase()] ?? entity;
  });
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = (pdfjs as any).getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = (textContent.items as Array<{ str?: string; transform?: number[] }>)
      .filter((item) => typeof item.str === "string" && item.str.trim().length > 0)
      .map((item) => ({
        text: item.str?.trim() || "",
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
      }))
      .sort((a, b) => (Math.abs(a.y - b.y) < 1 ? a.x - b.x : b.y - a.y));

    const lines: string[] = [];
    let currentY: number | null = null;
    let currentLine: string[] = [];

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) <= 2) {
        currentY = currentY ?? item.y;
        currentLine.push(item.text);
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" "));
        }
        currentY = item.y;
        currentLine = [item.text];
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "));
    }

    pages.push(lines.join("\n"));
  }

  return normalizeText(pages.join("\n\n"));
}

interface ExtractedPdfPayload {
  text: string;
  blocks: ParsedBlock[];
  figures: ParsedFigure[];
  tables: ParsedTable[];
  diagnostics: ParseDiagnostic[];
}

function makeBlockBbox(x: number, y: number, width: number, height: number): ParsedBoundingBox {
  return { x, y, width, height };
}

function classifyLineType(line: string): ParsedBlock["type"] {
  const trimmed = line.trim();
  if (/^(fig(?:ure)?\.?\s*\d+|diagram\s*\d+)/i.test(trimmed)) return "caption";
  if (/^table\s*\d+/i.test(trimmed)) return "caption";
  if (/^(?:\[\d+\]|\d+[.)])\s+.+/.test(trimmed) && /\b(19|20)\d{2}\b/.test(trimmed)) return "reference";
  if (/\|/.test(trimmed) || /\t/.test(trimmed) || /\S+\s{2,}\S+/.test(trimmed)) return "table";
  return "text";
}

function tableLineToMatrix(line: string): string[][] {
  const row = line
    .split(/\||\t+|\s{2,}/g)
    .map((cell) => cell.trim())
    .filter(Boolean);
  return row.length > 0 ? [row] : [];
}

function matrixToHtml(matrix: string[][]): string {
  if (matrix.length === 0) return "<table><tbody></tbody></table>";
  const rows = matrix
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");
  return `<table><tbody>${rows}</tbody></table>`;
}

function createFigurePlaceholderData(label: string): string {
  const safe = label.replace(/[<>&'"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#f8fafc"/><rect x="10" y="10" width="620" height="340" rx="12" fill="#eef2ff" stroke="#c7d2fe"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#475569" font-family="Arial" font-size="18">${safe}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

async function extractPdfPayload(buffer: Buffer): Promise<ExtractedPdfPayload> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = (pdfjs as any).getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const pagesText: string[] = [];
  const blocks: ParsedBlock[] = [];
  const figures: ParsedFigure[] = [];
  const tables: ParsedTable[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  let blockCount = 0;
  let figureCount = 0;
  let tableCount = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = (textContent.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>)
      .filter((item) => typeof item.str === "string" && item.str.trim().length > 0)
      .map((item) => ({
        text: item.str?.trim() || "",
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        width: item.width || 0,
        height: Math.abs(item.height || 10),
      }))
      .sort((a, b) => (Math.abs(a.y - b.y) < 1 ? a.x - b.x : b.y - a.y));

    const lines: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];
    let currentY: number | null = null;
    let currentParts: typeof items = [];

    const flushLine = () => {
      if (currentParts.length === 0) return;
      const text = currentParts.map((p) => p.text).join(" ").trim();
      const x = Math.min(...currentParts.map((p) => p.x));
      const y = currentParts[0].y;
      const width = Math.max(...currentParts.map((p) => p.x + p.width)) - x;
      const height = Math.max(...currentParts.map((p) => p.height));
      lines.push({ text, x, y, width, height });
      currentParts = [];
    };

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) <= 2) {
        currentY = currentY ?? item.y;
        currentParts.push(item);
      } else {
        flushLine();
        currentY = item.y;
        currentParts = [item];
      }
    }
    flushLine();

    if (lines.length === 0) {
      diagnostics.push({
        level: "warning",
        code: "PDF_PAGE_EMPTY_TEXT",
        message: `Page ${pageNum} has no text layer content; OCR fallback required for strict extraction.`,
      });
      continue;
    }

    pagesText.push(lines.map((line) => line.text).join("\n"));

    for (const line of lines) {
      const type = classifyLineType(line.text);
      const blockId = `pdf-block-${++blockCount}`;
      const bbox = makeBlockBbox(line.x, line.y, line.width, line.height);

      blocks.push({
        id: blockId,
        type,
        text: line.text,
        page: pageNum,
        bbox,
        source: "text-layer",
        // 0.85: text-layer extraction is reliable but section/type classification
        // uses heuristic keyword matching — not guaranteed accurate.
        confidence: 0.85,
        diagnostics: type !== "text" ? [
          {
            level: "info" as const,
            code: "BLOCK_TYPE_HEURISTIC",
            message: `Block typed as "${type}" via keyword heuristic; review if misclassified.`,
          },
        ] : [],
        suggestedSection: type === "reference" ? "References" : "Content",
      });

      if (type === "caption" && /^(fig(?:ure)?\.?\s*\d+|diagram\s*\d+)/i.test(line.text)) {
        figures.push({
          id: `fig-${++figureCount}`,
          imageData: createFigurePlaceholderData(line.text || `Figure ${figureCount}`),
          caption: line.text,
          page: pageNum,
          bbox,
          confidence: 0.65,
          diagnostics: [
            {
              level: "warning",
              code: "CAPTION_LINK_UNCERTAIN",
              message: `Figure caption detected on page ${pageNum}; review association before commit.`,
            },
          ],
        });
      }

      if (type === "table") {
        const matrix = tableLineToMatrix(line.text);
        tables.push({
          id: `tbl-${++tableCount}`,
          html: matrixToHtml(matrix),
          matrix,
          page: pageNum,
          bbox,
          caption: undefined,
          confidence: matrix.length > 0 && (matrix[0]?.length || 0) > 1 ? 0.72 : 0.5,
          diagnostics: [
            {
              level: "warning",
              code: "TABLE_GRID_UNCERTAIN",
              message: `Table-like content detected on page ${pageNum}; review required.`,
            },
          ],
        });
      }
    }
  }

  return {
    text: normalizeText(pagesText.join("\n\n")),
    blocks,
    figures,
    tables,
    diagnostics,
  };
}

function extractReferencesFromOupHtml(html: string): string[] {
  const refs = Array.from(
    html.matchAll(/<div id="ref-auto-ref(\d+)"[\s\S]*?<p class="mixed-citation-compatibility">([\s\S]*?)<\/p>/g),
  )
    .map((match) => ({
      index: Number(match[1]),
      text: match[2]
        .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .trim(),
    }))
    .map((ref) => ({
      ...ref,
      text: decodeHtmlEntities(ref.text)
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .trim(),
    }))
    .sort((a, b) => a.index - b.index)
    .map((ref) => ref.text);

  return refs;
}

export async function parseUploadedDocument(input: ParseUploadInput): Promise<RawParsedDocument> {
  const diagnostics: ParseDiagnostic[] = [];
  const extension = extname(input.fileName);
  const fileTitle = sanitizeTitle(input.fileName);

  if (extension === "docx") {
    const mammothStyleMap = [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Abstract'] => h2:fresh",
      "p[style-name='abstract'] => h2:fresh",
      "p[style-name='Section Heading'] => h2:fresh",
    ];

    const result = await mammoth.convertToHtml({
      buffer: input.buffer,
      styleMap: mammothStyleMap,
    } as any);
    const warnings = (result.messages || []).map((message) => ({
      level: "warning" as const,
      code: "DOCX_PARSE_WARNING",
      message: message.message,
    }));

    // Inform callers that complex Word formatting (tracked changes, embedded objects,
    // custom styles) may not survive the HTML conversion faithfully.
    const fidelityNote: ParseDiagnostic[] = [
      {
        level: "info",
        code: "DOCX_FIDELITY_NOTICE",
        message:
          "DOCX parsed via HTML conversion. Complex formatting (tracked changes, nested tables, " +
          "custom styles, embedded objects) may not be fully preserved — review imported content.",
      },
    ];

    let llmParsed;
    try {
      const textResult = await mammoth.extractRawText({ buffer: input.buffer });
      if (textResult.value.trim().length > 0) {
        llmParsed = await parseDocumentWithLLM(textResult.value);
      }
    } catch (error) {
      diagnostics.push({
        level: "warning",
        code: "LLM_PARSE_FAILED",
        message: error instanceof Error ? error.message : "Local LLM parsing failed, falling back to heuristics.",
      });
    }

    return {
      fileTitle,
      format: "docx",
      html: result.value,
      diagnostics: [...diagnostics, ...fidelityNote, ...warnings],
      references: extractReferencesFromOupHtml(result.value),
      llmParsed,
    };
  }

  if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "gif" || extension === "webp") {
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const mime = input.mimeType ?? mimeMap[extension] ?? "image/jpeg";
    const dataUrl = `data:${mime};base64,${input.buffer.toString("base64")}`;
    return {
      fileTitle,
      format: "image",
      imageDataUrl: dataUrl,
      diagnostics,
    };
  }

  if (extension === "pdf") {
    try {
      const payload = await extractPdfPayload(input.buffer);
      
      let llmParsed;
      try {
        if (payload.text.trim().length > 0) {
          llmParsed = await parseDocumentWithLLM(payload.text);
        }
      } catch (error) {
        diagnostics.push({
          level: "warning",
          code: "LLM_PARSE_FAILED",
          message: error instanceof Error ? error.message : "Local LLM parsing failed, falling back to heuristics.",
        });
      }

      if (!payload.text) {
        diagnostics.push({
          level: "warning",
          code: "PDF_EMPTY_TEXT",
          message:
            "No selectable text found in this PDF. It appears to be a scanned image. " +
            "This service does not perform OCR — content will be empty until a text-layer PDF is uploaded.",
        });
      }
      return {
        fileTitle,
        format: "pdf",
        text: payload.text,
        blocks: payload.blocks,
        figures: payload.figures,
        tables: payload.tables,
        links: [],
        diagnostics: [...diagnostics, ...payload.diagnostics],
        llmParsed,
      };
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "PDF_PARSE_FAILED",
        message: error instanceof Error ? error.message : "PDF parsing failed",
      });
      return {
        fileTitle,
        format: "pdf",
        text: "",
        diagnostics,
      };
    }
  }

  throw new Error(`Unsupported file type: ${extension || "unknown"}`);
}
