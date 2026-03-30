import mammoth from "mammoth";
import type { ParseDiagnostic, RawParsedDocument } from "../../shared/document-parse";

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

    return {
      fileTitle,
      format: "docx",
      html: result.value,
      diagnostics: [...diagnostics, ...warnings],
      references: extractReferencesFromOupHtml(result.value),
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
      const text = await extractPdfText(input.buffer);
      if (!text) {
        diagnostics.push({
          level: "warning",
          code: "PDF_EMPTY_TEXT",
          message: "No text could be extracted from this PDF. It may be scanned-image only.",
        });
      }
      return {
        fileTitle,
        format: "pdf",
        text,
        diagnostics,
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
