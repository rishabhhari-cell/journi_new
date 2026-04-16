import mammoth from "mammoth";
import { XMLParser } from "fast-xml-parser";
import type { ParseDiagnostic, ParsedBlock, ParsedBoundingBox, ParsedFigure, ParsedTable, RawParsedDocument } from "../../shared/document-parse";
import { parseRawDocument } from "../../shared/document-parse";
import { parseDocumentWithLLM } from "./llm.service";
import { runDeterministicErrorChecks } from "./parse-error-detection.service";
import { extractDocxXmlStructure } from "./docx-xml-parse.service";
import { computeParseConfidence } from "./parse-confidence.service";

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

const DOCX_IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const DOCX_CHART_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function textFromXmlNode(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) return node.map((entry) => textFromXmlNode(entry)).join("");
  if (typeof node === "object") {
    return Object.entries(node as Record<string, unknown>)
      .filter(([key]) => key !== "#text")
      .map(([, value]) => textFromXmlNode(value))
      .join("") || String((node as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pathToDocxMime(target: string): string {
  const lower = target.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}

function absoluteDocxPath(basePath: string, target: string): string {
  if (!target) return basePath;
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  const baseParts = basePath.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }
  return baseParts.join("/");
}

interface DocxChartSpec {
  title: string;
  type: "bar" | "pie" | "unsupported";
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
}

function readChartCachePoints(cache: any): string[] {
  const points = ensureArray(cache?.pt)
    .sort((a, b) => Number(a?.idx ?? 0) - Number(b?.idx ?? 0))
    .map((point) => textFromXmlNode(point?.v).trim())
    .filter(Boolean);
  return points;
}

function parseDocxChartSpec(xml: string): DocxChartSpec | null {
  const parsed = xmlParser.parse(xml);
  const chart = parsed?.chartSpace?.chart;
  const plotArea = chart?.plotArea;
  if (!chart || !plotArea) return null;

  const title = textFromXmlNode(chart?.title?.tx?.rich).replace(/\s+/g, " ").trim() || "Imported chart";
  const barChart = ensureArray(plotArea?.barChart)[0];
  const pieChart = ensureArray(plotArea?.pieChart)[0];

  if (barChart) {
    const series = ensureArray(barChart.ser).map((ser: any, index) => ({
      name: textFromXmlNode(ser?.tx?.strRef?.strCache).replace(/\s+/g, " ").trim() || `Series ${index + 1}`,
      values: readChartCachePoints(ser?.val?.numRef?.numCache).map((value) => Number(value)),
    }));
    const categories = readChartCachePoints(series.length > 0 ? barChart.ser?.[0]?.cat?.strRef?.strCache ?? barChart.ser?.cat?.strRef?.strCache : null);
    return { title, type: "bar", categories, series };
  }

  if (pieChart) {
    const series = ensureArray(pieChart.ser).map((ser: any, index) => ({
      name: textFromXmlNode(ser?.tx?.strRef?.strCache).replace(/\s+/g, " ").trim() || `Series ${index + 1}`,
      values: readChartCachePoints(ser?.val?.numRef?.numCache).map((value) => Number(value)),
    }));
    const categories = readChartCachePoints(pieChart.ser?.cat?.strRef?.strCache);
    return { title, type: "pie", categories, series };
  }

  return {
    title,
    type: "unsupported",
    categories: [],
    series: [],
  };
}

function createSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function renderDocxBarChartSvg(spec: DocxChartSpec): string {
  const width = 720;
  const height = 420;
  const margin = { top: 48, right: 24, bottom: 90, left: 180 };
  const plotWidth = width - margin.left - margin.right;
  const categories = spec.categories.length > 0 ? spec.categories : spec.series[0]?.values.map((_, index) => `Item ${index + 1}`) ?? [];
  const values = spec.series[0]?.values ?? [];
  const maxValue = Math.max(1, ...values, 1);
  const barHeight = Math.max(16, Math.floor((height - margin.top - margin.bottom) / Math.max(categories.length, 1) * 0.65));
  const gap = Math.max(8, Math.floor((height - margin.top - margin.bottom) / Math.max(categories.length, 1) * 0.35));
  const palette = ["#2f6fed", "#18a77a", "#d97706", "#b83280"];

  const bars = categories.map((label, index) => {
    const value = values[index] ?? 0;
    const y = margin.top + index * (barHeight + gap);
    const barWidth = Math.max(2, (value / maxValue) * plotWidth);
    return `
      <text x="${margin.left - 12}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-family="Arial" font-size="13" fill="#334155">${escapeHtml(label)}</text>
      <rect x="${margin.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${palette[index % palette.length]}" opacity="0.9" />
      <text x="${margin.left + barWidth + 8}" y="${y + barHeight / 2 + 4}" font-family="Arial" font-size="12" fill="#0f172a">${Number.isFinite(value) ? value : ""}</text>
    `;
  }).join("");

  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const x = margin.left + plotWidth * ratio;
    const label = Math.round(maxValue * ratio);
    return `
      <line x1="${x}" y1="${margin.top - 8}" x2="${x}" y2="${height - margin.bottom + 8}" stroke="#cbd5e1" stroke-dasharray="4 4" />
      <text x="${x}" y="${height - margin.bottom + 28}" text-anchor="middle" font-family="Arial" font-size="11" fill="#64748b">${label}</text>
    `;
  }).join("");

  return createSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#ffffff" />
      <text x="${margin.left}" y="28" font-family="Arial" font-size="18" font-weight="700" fill="#0f172a">${escapeHtml(spec.title)}</text>
      ${grid}
      ${bars}
    </svg>
  `.trim());
}

function renderDocxPieChartSvg(spec: DocxChartSpec): string {
  const width = 720;
  const height = 420;
  const cx = 230;
  const cy = 220;
  const radius = 120;
  const palette = ["#2f6fed", "#18a77a", "#d97706", "#b83280", "#0ea5e9", "#7c3aed", "#dc2626"];
  const categories = spec.categories.length > 0 ? spec.categories : spec.series[0]?.values.map((_, index) => `Item ${index + 1}`) ?? [];
  const values = spec.series[0]?.values ?? [];
  const total = Math.max(1, values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0));

  let angle = -Math.PI / 2;
  const slices = values.map((value, index) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const nextAngle = angle + (safeValue / total) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(nextAngle) * radius;
    const y2 = cy + Math.sin(nextAngle) * radius;
    const largeArc = nextAngle - angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    angle = nextAngle;
    return `<path d="${path}" fill="${palette[index % palette.length]}" stroke="#ffffff" stroke-width="2" />`;
  }).join("");

  const legend = categories.map((label, index) => {
    const y = 110 + index * 28;
    const value = values[index] ?? 0;
    const pct = Math.round(((Number.isFinite(value) ? value : 0) / total) * 100);
    return `
      <rect x="430" y="${y - 12}" width="14" height="14" rx="3" fill="${palette[index % palette.length]}" />
      <text x="452" y="${y}" font-family="Arial" font-size="13" fill="#334155">${escapeHtml(label)} (${pct}%)</text>
    `;
  }).join("");

  return createSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#ffffff" />
      <text x="40" y="36" font-family="Arial" font-size="18" font-weight="700" fill="#0f172a">${escapeHtml(spec.title)}</text>
      ${slices}
      ${legend}
    </svg>
  `.trim());
}

function createDocxChartFigure(spec: DocxChartSpec, id: string): ParsedFigure {
  const imageData =
    spec.type === "bar"
      ? renderDocxBarChartSvg(spec)
      : spec.type === "pie"
        ? renderDocxPieChartSvg(spec)
        : createFigurePlaceholderData(spec.title || id);

  return {
    id,
    imageData,
    caption: undefined,
    page: 1,
    confidence: spec.type === "unsupported" ? 0.75 : 0.96,
    diagnostics: spec.type === "unsupported"
      ? [{
          level: "warning",
          code: "DOCX_CHART_RENDER_FALLBACK",
          message: "Embedded chart format is unsupported for full SVG rendering; placeholder used.",
        }]
      : [],
  };
}

function makeBlockBbox(x: number, y: number, width: number, height: number): ParsedBoundingBox {
  return { x, y, width, height };
}

function classifyLineType(line: string): ParsedBlock["type"] {
  const trimmed = line.trim();
  if (/^(fig(?:ure)?\.?\s*\d+|diagram\s*\d+)/i.test(trimmed)) return "caption";
  if (/^table\s*\d+/i.test(trimmed)) return "caption";
  // Numbered references: [1], 1., 1)
  if (/^(?:\[\d+\]|\d+[.)])\s+.+/.test(trimmed) && /\b(19|20)\d{2}\b/.test(trimmed)) return "reference";
  // Author-year references: "Smith J. (2020)." or "Smith J, et al. 2020"
  if (/^[A-Z][a-z]+\s+[A-Z]/.test(trimmed) && /\b(19|20)\d{2}\b/.test(trimmed) && trimmed.length > 30) return "reference";
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

async function extractDocxFigures(
  buffer: Buffer,
  relsPath = "word/_rels/document.xml.rels",
  mainDocPath = "word/document.xml",
): Promise<{ figures: ParsedFigure[]; diagnostics: ParseDiagnostic[] }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const diagnostics: ParseDiagnostic[] = [];
  const figures: ParsedFigure[] = [];

  const relsXml = await zip.file(relsPath)?.async("string");
  const documentXml = await zip.file(mainDocPath)?.async("string");
  if (!relsXml || !documentXml) {
    return { figures, diagnostics };
  }

  const relsParsed = xmlParser.parse(relsXml);
  const relationships = ensureArray(relsParsed?.Relationships?.Relationship);
  const relMap = new Map<string, { target: string; type: string }>();
  for (const rel of relationships) {
    if (!rel?.Id || !rel?.Target) continue;
    relMap.set(String(rel.Id), { target: String(rel.Target), type: String(rel.Type ?? "") });
  }

  const drawingRefs = Array.from(
    documentXml.matchAll(/<(?:a:blip|c:chart)\b[^>]*r:(?:embed|id)="([^"]+)"/g),
  ).map((match) => match[1]);

  let figureCount = 0;
  for (const relId of drawingRefs) {
    const rel = relMap.get(relId);
    if (!rel) continue;

    if (rel.type === DOCX_IMAGE_REL) {
      const absolutePath = absoluteDocxPath(mainDocPath, rel.target);
      const file = zip.file(absolutePath);
      if (!file) continue;
      const bytes = await file.async("uint8array");
      figures.push({
        id: `docx-figure-${++figureCount}`,
        imageData: `data:${pathToDocxMime(absolutePath)};base64,${Buffer.from(bytes).toString("base64")}`,
        page: 1,
        confidence: 0.99,
        diagnostics: [],
      });
      continue;
    }

    if (rel.type === DOCX_CHART_REL) {
      const absolutePath = absoluteDocxPath(mainDocPath, rel.target);
      const file = zip.file(absolutePath);
      if (!file) continue;
      const chartXml = await file.async("string");
      const spec = parseDocxChartSpec(chartXml);
      if (!spec) {
        diagnostics.push({
          level: "warning",
          code: "DOCX_CHART_PARSE_FAILED",
          message: `Embedded chart ${absolutePath} could not be parsed deterministically.`,
        });
        continue;
      }
      figures.push(createDocxChartFigure(spec, `docx-figure-${++figureCount}`));
    }
  }

  return { figures, diagnostics };
}

function multiplyTransform(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyTransform(matrix: number[], x: number, y: number): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function bboxFromTransform(matrix: number[]): ParsedBoundingBox {
  const points = [
    applyTransform(matrix, 0, 0),
    applyTransform(matrix, 1, 0),
    applyTransform(matrix, 0, 1),
    applyTransform(matrix, 1, 1),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function normalizePdfImageBytes(imgData: any, imageKind: Record<string, number>): Uint8Array {
  const width = Number(imgData?.width || 0);
  const height = Number(imgData?.height || 0);
  const source = imgData?.data instanceof Uint8Array ? imgData.data : new Uint8Array(imgData?.data || []);
  const rgba = new Uint8Array(width * height * 4);

  if (imgData?.kind === imageKind.RGBA_32BPP) {
    return source;
  }

  if (imgData?.kind === imageKind.RGB_24BPP) {
    for (let i = 0, j = 0; i < source.length; i += 3, j += 4) {
      rgba[j] = source[i] ?? 0;
      rgba[j + 1] = source[i + 1] ?? 0;
      rgba[j + 2] = source[i + 2] ?? 0;
      rgba[j + 3] = 255;
    }
    return rgba;
  }

  if (imgData?.kind === imageKind.GRAYSCALE_1BPP) {
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = source[y * rowBytes + Math.floor(x / 8)] ?? 0;
        const bit = (byte >> (7 - (x % 8))) & 1;
        const value = bit ? 0 : 255;
        const idx = (y * width + x) * 4;
        rgba[idx] = value;
        rgba[idx + 1] = value;
        rgba[idx + 2] = value;
        rgba[idx + 3] = 255;
      }
    }
    return rgba;
  }

  return rgba;
}

async function pdfImageDataToDataUrl(imgData: any, imageKind: Record<string, number>): Promise<string | null> {
  if (!imgData?.width || !imgData?.height || !imgData?.data) return null;
  const { encode } = await import("fast-png");
  const rgba = normalizePdfImageBytes(imgData, imageKind);
  const png = encode({
    width: imgData.width,
    height: imgData.height,
    data: rgba,
    depth: 8,
    channels: 4,
  } as any);
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

async function waitForPdfObject(
  objs: { has: (id: string) => boolean; get: (id: string, callback?: (value: any) => void) => any },
  objId: string,
): Promise<any | null> {
  if (objs.has(objId)) {
    try {
      return objs.get(objId);
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 1500);
    try {
      objs.get(objId, (value: any) => {
        clearTimeout(timeout);
        resolve(value);
      });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

async function extractImagesFromXObject(
  page: any,
  xobjId: string,
  parentTransform: number[],
  depth: number,
): Promise<Array<{ imageData: any; bbox: ParsedBoundingBox }>> {
  if (depth > 2) return []; // cap recursion — figures never nest deeper in practice

  const xobj = await waitForPdfObject(page.commonObjs as any, xobjId)
    ?? await waitForPdfObject(page.objs as any, xobjId);
  if (!xobj?.operatorList) return [];

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const results: Array<{ imageData: any; bbox: ParsedBoundingBox }> = [];
  let localTransform = [...parentTransform];
  const stack: number[][] = [];

  for (let i = 0; i < xobj.operatorList.fnArray.length; i += 1) {
    const fn = xobj.operatorList.fnArray[i];
    const fnArgs = xobj.operatorList.argsArray[i] || [];

    if (fn === (pdfjs as any).OPS.save) { stack.push([...localTransform]); continue; }
    if (fn === (pdfjs as any).OPS.restore) { localTransform = stack.pop() || localTransform; continue; }
    if (fn === (pdfjs as any).OPS.transform) {
      localTransform = multiplyTransform(localTransform, fnArgs as number[]);
      continue;
    }
    if (fn === (pdfjs as any).OPS.paintXObject) {
      const nested = await extractImagesFromXObject(page, String(fnArgs[0] || ""), localTransform, depth + 1);
      results.push(...nested);
      continue;
    }
    if (
      fn === (pdfjs as any).OPS.paintImageXObject ||
      fn === (pdfjs as any).OPS.paintInlineImageXObject ||
      fn === (pdfjs as any).OPS.paintImageXObjectRepeat
    ) {
      let imgData: any = null;
      if (fn === (pdfjs as any).OPS.paintInlineImageXObject) {
        imgData = fnArgs[0];
      } else {
        imgData = await waitForPdfObject(page.objs as any, String(fnArgs[0] || ""));
      }
      if (imgData) {
        results.push({ imageData: imgData, bbox: bboxFromTransform(localTransform) });
      }
    }
  }
  return results;
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
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = (textContent.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>)
      .filter((item) => typeof item.str === "string" && item.str.trim().length > 0)
      .map((item) => {
        const t = item.transform || [1, 0, 0, 1, 0, 0];
        const fontSize = Math.sqrt(t[0] * t[0] + t[1] * t[1]) || Math.abs(item.height || 10);
        return {
          text: item.str?.trim() || "",
          x: t[4] || 0,
          y: t[5] || 0,
          width: item.width || 0,
          height: fontSize,
        };
      })
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
      if (currentY === null || Math.abs(item.y - currentY) <= 5) {
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

    // Compute median body font height for this page to identify large-font headings.
    const pageHeights = lines.map((l) => l.height).filter((h) => h > 4 && h < 50);
    const sortedHeights = [...pageHeights].sort((a, b) => a - b);
    const medianBodySize = sortedHeights[Math.floor(sortedHeights.length / 2)] || 10;

    pagesText.push(lines.map((line) => line.text).join("\n"));

    for (const line of lines) {
      const type = classifyLineType(line.text);
      const blockId = `pdf-block-${++blockCount}`;
      const bbox = makeBlockBbox(line.x, line.y, line.width, line.height);
      const isLargeFont = line.height > medianBodySize * 1.2;

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
        isLargeFont,
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

    const operatorList = await page.getOperatorList();
    const stack: number[][] = [];
    let currentTransform = [1, 0, 0, 1, 0, 0];
    const minFigureWidth = Math.max(24, viewport.width * 0.06);
    const minFigureHeight = Math.max(24, viewport.height * 0.06);

    for (let opIndex = 0; opIndex < operatorList.fnArray.length; opIndex += 1) {
      const fn = operatorList.fnArray[opIndex];
      const args = operatorList.argsArray[opIndex] || [];

      if (fn === (pdfjs as any).OPS.save) {
        stack.push([...currentTransform]);
        continue;
      }

      if (fn === (pdfjs as any).OPS.restore) {
        currentTransform = stack.pop() || [1, 0, 0, 1, 0, 0];
        continue;
      }

      if (fn === (pdfjs as any).OPS.transform) {
        currentTransform = multiplyTransform(currentTransform, args as number[]);
        continue;
      }

      if (fn === (pdfjs as any).OPS.paintXObject) {
        const xobjId = String(args[0] || "");
        if (xobjId) {
          const xobjImages = await extractImagesFromXObject(page, xobjId, currentTransform, 0);
          for (const { imageData, bbox } of xobjImages) {
            if (bbox.width < minFigureWidth || bbox.height < minFigureHeight) continue;
            const dataUrl = await pdfImageDataToDataUrl(imageData, (pdfjs as any).ImageKind);
            if (!dataUrl) {
              diagnostics.push({
                level: "warning",
                code: "PDF_XOBJECT_IMAGE_CONVERSION_FAILED",
                message: `Form XObject image in ${xobjId} could not be converted to data URL.`,
              });
              continue;
            }
            figures.push({
              id: `fig-${++figureCount}`,
              imageData: dataUrl,
              page: pageNum,
              bbox,
              confidence: 0.92,
              diagnostics: [],
            });
          }
        }
        continue;
      }

      const isImageOp =
        fn === (pdfjs as any).OPS.paintImageXObject ||
        fn === (pdfjs as any).OPS.paintInlineImageXObject ||
        fn === (pdfjs as any).OPS.paintImageXObjectRepeat;

      if (!isImageOp) continue;

      const bbox = bboxFromTransform(currentTransform);
      if (bbox.width < minFigureWidth || bbox.height < minFigureHeight) {
        continue;
      }

      let imageData: any = null;
      let imageId = `pdf-figure-${pageNum}-${opIndex}`;

      if (fn === (pdfjs as any).OPS.paintInlineImageXObject) {
        imageData = args[0];
      } else {
        const objId = String(args[0]);
        imageId = objId;
        imageData = await waitForPdfObject(page.objs as any, objId);
      }

      const dataUrl = await pdfImageDataToDataUrl(imageData, (pdfjs as any).ImageKind);
      if (!dataUrl) {
        diagnostics.push({
          level: "warning",
          code: "PDF_IMAGE_EXTRACTION_FAILED",
          message: `An embedded image on page ${pageNum} could not be converted into a deterministic figure asset.`,
        });
        continue;
      }

      figures.push({
        id: `fig-${++figureCount}`,
        imageData: dataUrl,
        page: pageNum,
        bbox,
        confidence: 0.95,
        diagnostics: [],
      });
    }

    const captionBlocks = blocks.filter((block) => block.page === pageNum && block.type === "caption");
    const usedCaptionIds = new Set<string>();
    for (const figure of figures.filter((item) => item.page === pageNum)) {
      const match = captionBlocks
        .filter((block) => !usedCaptionIds.has(block.id))
        .map((block) => {
          const sameColumnPenalty = figure.bbox ? Math.abs((block.bbox?.x || 0) - figure.bbox.x) : 0;
          const verticalDelta = figure.bbox ? Math.abs((block.bbox?.y || 0) - figure.bbox.y) : 0;
          const isBelow = figure.bbox && block.bbox ? block.bbox.y <= figure.bbox.y : true;
          return {
            block,
            score: verticalDelta + sameColumnPenalty + (isBelow ? 0 : 120),
          };
        })
        .sort((a, b) => a.score - b.score)[0];

      if (match && match.score < Math.max(viewport.height * 0.35, 220)) {
        figure.caption = match.block.text;
        usedCaptionIds.add(match.block.id);
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

/**
 * Merge LLM sections into deterministic sections.
 * - Deterministic section with ≥30 words → keep as-is
 * - Deterministic section with <30 words AND LLM has matching section with ≥20 words → use LLM
 * - LLM section for a slot with no deterministic section → include LLM
 * - LLM sections with <20 words → rejected
 */
function mergeLlmSections(
  deterministicSections: Array<{ title: string; content: string; wordCount: number }>,
  llmSections: Array<{ title: string; content: string }>,
): Array<{ title: string; content: string }> {
  const llmMap = new Map<string, string>();
  for (const sec of llmSections) {
    const wordCount = sec.content.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 20) {
      llmMap.set(sec.title.toLowerCase(), sec.content);
    }
  }

  const merged: Array<{ title: string; content: string }> = [];
  const usedLlmTitles = new Set<string>();

  for (const det of deterministicSections) {
    if (det.wordCount >= 30) {
      merged.push({ title: det.title, content: det.content });
    } else {
      const llmContent = llmMap.get(det.title.toLowerCase());
      if (llmContent) {
        merged.push({ title: det.title, content: `<p>${llmContent}</p>` });
        usedLlmTitles.add(det.title.toLowerCase());
      } else {
        merged.push({ title: det.title, content: det.content });
      }
    }
  }

  // Add LLM-only sections not covered by deterministic
  for (const [titleKey, content] of llmMap.entries()) {
    if (!usedLlmTitles.has(titleKey)) {
      const titleFormatted = titleKey.charAt(0).toUpperCase() + titleKey.slice(1);
      merged.push({ title: titleFormatted, content: `<p>${content}</p>` });
    }
  }

  return merged;
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

    // Run XML walker, Mammoth HTML in parallel; figure extraction uses XML walker result
    const [xmlResult, result, textResult] = await Promise.all([
      extractDocxXmlStructure(input.buffer),
      mammoth.convertToHtml({ buffer: input.buffer, styleMap: mammothStyleMap } as any),
      mammoth.extractRawText({ buffer: input.buffer } as any),
    ]);
    // Use the correct rels path found by the XML walker (not hardcoded word/_rels/document.xml.rels)
    const extractedFigures = await extractDocxFigures(
      input.buffer,
      xmlResult.figureRelsPath,
      xmlResult.mainDocumentPath,
    );

    const warnings = (result.messages || []).map((message) => ({
      level: "warning" as const,
      code: "DOCX_PARSE_WARNING",
      message: message.message,
    }));

    const fidelityNote: ParseDiagnostic[] = [
      {
        level: "info",
        code: "DOCX_FIDELITY_NOTICE",
        message:
          "DOCX parsed via XML + HTML conversion. Complex formatting may not be fully preserved — review imported content.",
      },
    ];

    // Merge XML structure with Mammoth HTML content:
    // XML walker provides section titles; Mammoth HTML provides body content.
    let mergedHtml: string;
    if (xmlResult.sections.length >= 2) {
      const htmlParts: string[] = [];
      for (const section of xmlResult.sections) {
        if (section.title !== "Content") {
          htmlParts.push(`<h2>${escapeHtml(section.title)}</h2>`);
        }
        for (const para of section.paragraphTexts) {
          htmlParts.push(`<p>${escapeHtml(para)}</p>`);
        }
      }
      mergedHtml = htmlParts.join("\n");
    } else {
      // XML walker found no structure — fall back to Mammoth HTML
      mergedHtml = result.value;
    }

    // Append reference lines from footnotes/endnotes found by XML walker
    const xmlReferenceLines = xmlResult.referenceLines;

    const rawDocx: RawParsedDocument = {
      fileTitle,
      format: "docx",
      html: mergedHtml,
      text: normalizeText(textResult.value),
      diagnostics: [
        ...diagnostics,
        ...fidelityNote,
        ...warnings,
        ...extractedFigures.diagnostics,
        ...xmlResult.diagnostics,
      ],
      figures: extractedFigures.figures,
      references: [
        ...extractReferencesFromOupHtml(result.value),
        ...xmlReferenceLines,
      ],
    };

    // Compute confidence score to decide whether to call Modal LLM
    const parsedDocxPrelim = parseRawDocument(rawDocx);
    const referenceLinesFound = (rawDocx.references ?? []).length;
    const figureCaptionsFound = parsedDocxPrelim.sections
      .flatMap((s) => {
        const matches = s.content.match(/^(figure|fig\.?)\s*\d+\s*[:.]/gim);
        return matches ?? [];
      }).length;

    const { score: confidenceScore } = computeParseConfidence(parsedDocxPrelim, {
      referenceLinesFound,
      figureCaptionsFound,
    });

    let llmParsed: RawParsedDocument["llmParsed"] | undefined;
    if (confidenceScore < 0.85) {
      try {
        if (textResult.value.trim().length > 0) {
          llmParsed = await parseDocumentWithLLM(textResult.value);
          diagnostics.push({
            level: "info",
            code: "LLM_FALLBACK_USED",
            message: `Parse confidence ${confidenceScore.toFixed(2)} below threshold; AI-assisted parsing used.`,
          });
        }
      } catch (error) {
        diagnostics.push({
          level: "warning",
          code: "LLM_PARSE_FAILED",
          message: error instanceof Error ? error.message : "AI-assisted parsing failed; manual review required.",
        });
      }
    }

    // Merge LLM result: LLM fills empty/missing sections, deterministic wins where populated
    const mergedSections = llmParsed ? mergeLlmSections(parsedDocxPrelim.sections, llmParsed.sections) : undefined;

    const finalRawDocx: RawParsedDocument = {
      ...rawDocx,
      llmParsed: mergedSections
        ? { sections: mergedSections, citations: llmParsed?.citations ?? [] }
        : undefined,
    };

    const parsedDocx = parseRawDocument(finalRawDocx);
    const finalParsed: typeof parsedDocx = {
      ...parsedDocx,
      parseConfidence: confidenceScore,
    };

    const errorDiagsDocx = runDeterministicErrorChecks(finalParsed);
    return {
      ...finalRawDocx,
      diagnostics: [...(finalRawDocx.diagnostics ?? []), ...errorDiagsDocx],
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

      if (!payload.text) {
        diagnostics.push({
          level: "warning",
          code: "PDF_EMPTY_TEXT",
          message:
            "No selectable text found in this PDF. It appears to be a scanned image. " +
            "This service does not perform OCR — content will be empty until a text-layer PDF is uploaded.",
        });
      }

      const rawPdfPrelim: RawParsedDocument = {
        fileTitle,
        format: "pdf",
        text: payload.text,
        blocks: payload.blocks,
        figures: payload.figures,
        tables: payload.tables,
        links: [],
        diagnostics: [...diagnostics, ...payload.diagnostics],
      };

      // Compute confidence score to decide whether to call Modal LLM
      const parsedPdfPrelim = parseRawDocument(rawPdfPrelim);
      const pdfReferenceLinesFound = (rawPdfPrelim.references ?? []).length;
      const pdfFigureCaptionsFound = parsedPdfPrelim.sections
        .flatMap((s) => {
          const matches = s.content.match(/^(figure|fig\.?)\s*\d+\s*[:.]/gim);
          return matches ?? [];
        }).length;

      const { score: pdfConfidenceScore } = computeParseConfidence(parsedPdfPrelim, {
        referenceLinesFound: pdfReferenceLinesFound,
        figureCaptionsFound: pdfFigureCaptionsFound,
      });

      let llmParsed: RawParsedDocument["llmParsed"] | undefined;
      if (pdfConfidenceScore < 0.85 && payload.text.trim().length > 0) {
        try {
          llmParsed = await parseDocumentWithLLM(payload.text);
          diagnostics.push({
            level: "info",
            code: "LLM_FALLBACK_USED",
            message: `Parse confidence ${pdfConfidenceScore.toFixed(2)} below threshold; AI-assisted parsing used.`,
          });
        } catch (error) {
          diagnostics.push({
            level: "warning",
            code: "LLM_PARSE_FAILED",
            message: error instanceof Error ? error.message : "AI-assisted parsing failed; manual review required.",
          });
        }
      }

      // Merge LLM result: LLM fills empty/missing sections, deterministic wins where populated
      const pdfMergedSections = llmParsed ? mergeLlmSections(parsedPdfPrelim.sections, llmParsed.sections) : undefined;

      const rawPdf: RawParsedDocument = {
        ...rawPdfPrelim,
        diagnostics: [...diagnostics, ...payload.diagnostics],
        llmParsed: pdfMergedSections
          ? { sections: pdfMergedSections, citations: llmParsed?.citations ?? [] }
          : undefined,
      };
      const parsedPdf = parseRawDocument(rawPdf);
      const finalParsedPdf: typeof parsedPdf = {
        ...parsedPdf,
        parseConfidence: pdfConfidenceScore,
      };
      const errorDiagsPdf = runDeterministicErrorChecks(finalParsedPdf);
      return { ...rawPdf, diagnostics: [...(rawPdf.diagnostics ?? []), ...errorDiagsPdf] };
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
