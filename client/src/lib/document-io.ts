/**
 * Document Import/Export Utilities
 * - Robust DOCX/PDF import with server-assisted parsing + worker normalization
 * - Deterministic DOCX/PDF export from canonical manuscript HTML
 */
import type { CitationFormData, DocumentSection, Manuscript } from '@/types';
import type {
  ParseDiagnostic,
  ParsedBlock,
  ParsedFigure,
  ParsedLink,
  ParsedManuscript,
  ParsedSection,
  ParsedTable,
  RawParsedDocument,
} from '@shared/document-parse';
import type { ImportSessionItemDTO as ImportSessionItemApiDTO, ImportSessionStatus } from '@shared/backend';
import { parseManuscriptUpload } from '@/lib/api/backend';
import {
  containsLikelyEncodingArtifacts,
  normalizeImportedHtml,
  normalizePlainImportedText,
} from '@/lib/import-normalization';

export interface ImportDocumentResult {
  fileName: string;
  sourceFormat: 'docx' | 'pdf' | 'image';
  title: string;
  sections: Partial<DocumentSection>[];
  citations: CitationFormData[];
  diagnostics: ParseDiagnostic[];
  totalWordCount: number;
  status: ImportSessionStatus;
  unsupportedReason: string | null;
  items: ImportSessionItemApiDTO[];
  review: {
    required: boolean;
    blocks: ParsedBlock[];
    figures: ParsedFigure[];
    tables: ParsedTable[];
    links: ParsedLink[];
  };
}

function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') {
    return `Imported Manuscript - ${new Date().toISOString().split('T')[0]}`;
  }

  // Remove file extension first
  const withoutExt = name.replace(/\.[^.]+$/, '');

  // Strip special characters but keep spaces, dashes, underscores
  const sanitized = withoutExt.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();

  // If sanitization results in empty string, use date-based fallback
  if (!sanitized || sanitized.length < 2) {
    return `Imported Manuscript - ${new Date().toISOString().split('T')[0]}`;
  }

  // Truncate very long filenames
  if (sanitized.length > 100) {
    return sanitized.slice(0, 97) + '...';
  }

  return sanitized;
}

function deriveImportStatus(
  raw: RawParsedDocument,
  diagnostics: ParseDiagnostic[],
  reviewRequired: boolean,
): { status: ImportSessionStatus; unsupportedReason: string | null } {
  const hasReviewBlockingDiagnostics = diagnostics.some((item) => {
    if (item.level === 'info') return false;
    if (item.level === 'error') return true;
    if (raw.format === 'docx') return item.code !== 'DOCX_PARSE_WARNING';
    return true;
  });

  if (raw.format === 'image') {
    return {
      status: 'manual_only',
      unsupportedReason: 'Image and scanned-document imports require manual handling until an OCR/layout engine is added.',
    };
  }

  const emptyPdf = raw.format === 'pdf' && !raw.text?.trim();
  if (emptyPdf) {
    return {
      status: 'unsupported',
      unsupportedReason: 'This PDF has no text layer. OCR/layout extraction is not implemented in the deterministic path.',
    };
  }

  if (reviewRequired || hasReviewBlockingDiagnostics) {
    return { status: 'pending_review', unsupportedReason: null };
  }

  return { status: 'ready_to_commit', unsupportedReason: null };
}

function buildDocxImportItems(
  raw: RawParsedDocument,
  parsed: {
    sections: Array<Pick<ParsedSection, 'title' | 'content' | 'sourceTitle'>>;
    citations: ParsedManuscript['citations'];
  },
): ImportSessionItemApiDTO[] {
  const items: ImportSessionItemApiDTO[] = parsed.sections.map((section, index) => ({
    id: `section-${index + 1}`,
    type: 'section',
    sourceFormat: 'docx',
    title: section.title,
    text: null,
    html: normalizeImportedHtml(section.content),
    page: null,
    bbox: null,
    confidence: 0.98,
    diagnostics: [],
    proposedSectionTitle: section.title,
    assignedSectionTitle: section.title,
    decision: 'pending',
    metadata: { sourceTitle: section.sourceTitle ?? null },
  }));

  parsed.citations.forEach((citation, index) => {
    items.push({
      id: `reference-${index + 1}`,
      type: 'reference',
      sourceFormat: 'docx',
      title: citation.title,
      text: citation.metadata?.raw ? String(citation.metadata.raw) : citation.title,
      html: null,
      page: null,
      bbox: null,
      confidence: 0.95,
      diagnostics: [],
      proposedSectionTitle: 'References',
      assignedSectionTitle: 'References',
      decision: 'pending',
      metadata: {
        authors: citation.authors,
        doi: citation.doi ?? null,
        url: citation.url ?? null,
        year: citation.year,
      },
    });
  });

  return items;
}

function buildPdfImportItems(parsed: ParsedManuscript): ImportSessionItemApiDTO[] {
  const items: ImportSessionItemApiDTO[] = [];

  for (const block of parsed.blocks || []) {
    if (block.type === 'table' || block.type === 'caption') continue;

    const type: ImportSessionItemApiDTO['type'] = block.type === 'reference' ? 'reference' : 'text_block';

    items.push({
      id: block.id,
      type,
      sourceFormat: 'pdf',
      title: null,
      text: normalizePlainImportedText(block.text || '', { trim: true }),
      html: null,
      page: block.page,
      bbox: block.bbox ?? null,
      confidence: block.confidence,
      diagnostics: block.diagnostics,
      proposedSectionTitle: block.type === 'reference' ? 'References' : (block.suggestedSection || 'Content'),
      assignedSectionTitle: block.type === 'reference' ? 'References' : (block.suggestedSection || 'Content'),
      decision: 'pending',
      metadata: { source: block.source, blockType: block.type },
    });
  }

  for (const figure of parsed.figures || []) {
    items.push({
      id: figure.id,
      type: 'figure_caption',
      sourceFormat: 'pdf',
      title: figure.caption ?? null,
      text: normalizePlainImportedText(figure.caption || 'Figure caption', { trim: true }),
      html: null,
      page: figure.page,
      bbox: figure.bbox ?? null,
      confidence: figure.confidence,
      diagnostics: figure.diagnostics,
      proposedSectionTitle: 'Results & Synthesis',
      assignedSectionTitle: 'Results & Synthesis',
      decision: 'pending',
      metadata: {
        previewImageData: figure.imageData,
        placeholderOnly: true,
      },
    });
  }

  for (const table of parsed.tables || []) {
    items.push({
      id: table.id,
      type: 'table_candidate',
      sourceFormat: 'pdf',
      title: table.caption ?? null,
      text: null,
      html: normalizeImportedHtml(table.html),
      page: table.page,
      bbox: table.bbox ?? null,
      confidence: table.confidence,
      diagnostics: table.diagnostics,
      proposedSectionTitle: 'Results & Synthesis',
      assignedSectionTitle: 'Results & Synthesis',
      decision: 'pending',
      metadata: {
        caption: table.caption ?? null,
        matrix: table.matrix,
      },
    });
  }

  return items;
}

function buildImageImportItems(raw: RawParsedDocument): ImportSessionItemApiDTO[] {
  return [
    {
      id: 'manual-image-1',
      type: 'manual_only',
      sourceFormat: 'image',
      title: raw.fileTitle,
      text: 'Image/scanned documents require manual handling until OCR and layout extraction are implemented.',
      html: raw.imageDataUrl ? `<p><img src="${raw.imageDataUrl}" alt="${raw.fileTitle}" style="max-width:100%" /></p>` : null,
      page: 1,
      bbox: null,
      confidence: 0,
      diagnostics: raw.diagnostics ?? [],
      proposedSectionTitle: null,
      assignedSectionTitle: null,
      decision: 'pending',
      metadata: {},
    },
  ];
}

function hasAnyEncodingArtifacts(values: string[]): boolean {
  for (const value of values) {
    if (!value) continue;
    if (containsLikelyEncodingArtifacts(value)) return true;
  }
  return false;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderReferences(citations: Manuscript['citations']): string {
  if (citations.length === 0) return '<p></p>';
  const rows = citations.map((citation, index) => {
    const authors = citation.authors?.join(', ') || 'Unknown';
    const year = citation.year || '';
    const journal = citation.journal ? ` <em>${citation.journal}</em>.` : '';
    const volume = citation.volume ? ` ${citation.volume}` : '';
    const issue = citation.issue ? `(${citation.issue})` : '';
    const pages = citation.pages ? `, ${citation.pages}` : '';
    const doi = citation.doi ? ` doi:${citation.doi}` : '';
    const url = citation.url ? ` ${citation.url}` : '';
    return `<li>${authors} (${year}). ${citation.title}.${journal}${volume}${issue}${pages}.${doi}${url}</li>`;
  });
  return `<ol>${rows.join('')}</ol>`;
}

function buildFullHtml(manuscript: Manuscript): string {
  const hasReferencesSection = manuscript.sections.some(
    (section) => section.title.trim().toLowerCase() === 'references',
  );
  const sectionsHtml = manuscript.sections
    .map((section) => `<h1>${section.title}</h1>\n${section.content || '<p></p>'}`)
    .join('\n');

  const referencesBlock =
    !hasReferencesSection && manuscript.citations.length > 0
      ? `<h1>References</h1>\n${renderReferences(manuscript.citations)}`
      : '';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${manuscript.title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 1in; color: #111; }
          h1 { font-size: 18pt; font-weight: bold; margin-top: 24pt; margin-bottom: 8pt; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; }
          h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; }
          p { margin-bottom: 8pt; }
          ul, ol { padding-left: 24pt; margin-bottom: 8pt; }
          blockquote { border-left: 3px solid #999; padding-left: 12pt; font-style: italic; color: #555; }
          table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
          td, th { border: 1px solid #ccc; padding: 6pt 8pt; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>
        <h1 style="font-size: 24pt; text-align: center; margin-bottom: 24pt;">${manuscript.title}</h1>
        ${sectionsHtml}
        ${referencesBlock}
      </body>
    </html>
  `.trim();
}

async function parseWithWorker(raw: RawParsedDocument): Promise<ParsedManuscript> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/document-parse.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<{ ok: boolean; data?: ParsedManuscript; error?: string }>) => {
      if (event.data.ok && event.data.data) {
        resolve(event.data.data);
      } else {
        reject(new Error(event.data.error || 'Failed to parse document in worker'));
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };

    worker.postMessage(raw);
  });
}

async function parseViaServer(file: File): Promise<RawParsedDocument | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }
  const base64 = btoa(binary);

  try {
    const response = await parseManuscriptUpload({
      fileName: file.name,
      mimeType: file.type || undefined,
      base64,
    });
    return response.data;
  } catch {
    return null;
  }
}

function extractReferencesFromOupHtml(html: string): string[] {
  return Array.from(
    html.matchAll(/<div id="ref-auto-ref(\d+)"[\s\S]*?<p class="mixed-citation-compatibility">([\s\S]*?)<\/p>/g),
  )
    .map((match) => ({
      index: Number(match[1]),
      text: match[2]
        .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim(),
    }))
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.text);
}

interface BrowserPdfExtractPayload {
  text: string;
  blocks: ParsedBlock[];
  figures: ParsedFigure[];
  tables: ParsedTable[];
  diagnostics: ParseDiagnostic[];
}

function classifyPdfLine(text: string): ParsedBlock['type'] {
  const trimmed = text.trim();
  if (/^(fig(?:ure)?\.?\s*\d+|diagram\s*\d+)/i.test(trimmed)) return 'caption';
  if (/^table\s*\d+/i.test(trimmed)) return 'caption';
  if (/^(?:\[\d+\]|\d+[.)])\s+.+/.test(trimmed) && /\b(19|20)\d{2}\b/.test(trimmed)) return 'reference';
  if (/\|/.test(trimmed) || /\t/.test(trimmed) || /\S+\s{2,}\S+/.test(trimmed)) return 'table';
  return 'text';
}

function tableRowToMatrix(line: string): string[][] {
  const row = line
    .split(/\||\t+|\s{2,}/g)
    .map((cell) => cell.trim())
    .filter(Boolean);
  return row.length > 0 ? [row] : [];
}

function tableMatrixToHtml(matrix: string[][]): string {
  if (matrix.length === 0) return '<table><tbody></tbody></table>';
  const rows = matrix.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

function createFigurePlaceholder(caption: string): string {
  const safeCaption = caption.replace(/[<>&'"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#f8fafc"/><rect x="10" y="10" width="620" height="340" rx="12" fill="#eef2ff" stroke="#c7d2fe"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#475569" font-family="Arial" font-size="18">${safeCaption}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

async function extractPdfTextInBrowser(arrayBuffer: ArrayBuffer): Promise<BrowserPdfExtractPayload> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;

  const loadingTask = (pdfjs as any).getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: true,
    disableFontFace: false,
  });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  const blocks: ParsedBlock[] = [];
  const figures: ParsedFigure[] = [];
  const tables: ParsedTable[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let blockCount = 0;
  let figureCount = 0;
  let tableCount = 0;

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>)
      .filter((item) => typeof item.str === 'string' && item.str.trim().length > 0)
      .map((item) => ({
        text: item.str?.trim() || '',
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        width: item.width || 0,
        height: Math.abs(item.height || 10),
      }))
      .sort((a, b) => (Math.abs(a.y - b.y) < 1 ? a.x - b.x : b.y - a.y));

    if (items.length === 0) {
      diagnostics.push({
        level: 'warning',
        code: 'PDF_PAGE_EMPTY_TEXT',
        message: `Page ${i} has no text layer content; OCR fallback required for strict extraction.`,
      });
      continue;
    }

    const lines: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];
    let currentY: number | null = null;
    let currentLine: typeof items = [];

    const flushLine = () => {
      if (currentLine.length === 0) return;
      const text = currentLine.map((line) => line.text).join(' ').trim();
      const x = Math.min(...currentLine.map((line) => line.x));
      const width = Math.max(...currentLine.map((line) => line.x + line.width)) - x;
      const height = Math.max(...currentLine.map((line) => line.height));
      lines.push({ text, x, y: currentLine[0].y, width, height });
      currentLine = [];
    };

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) <= 2) {
        currentY = currentY ?? item.y;
        currentLine.push(item);
      } else {
        flushLine();
        currentY = item.y;
        currentLine = [item];
      }
    }
    flushLine();

    pages.push(lines.map((line) => line.text).join('\n'));

    for (const line of lines) {
      const type = classifyPdfLine(line.text);
      const blockId = `pdf-block-${++blockCount}`;
      blocks.push({
        id: blockId,
        type,
        text: line.text,
        page: i,
        bbox: { x: line.x, y: line.y, width: line.width, height: line.height },
        source: 'text-layer',
        confidence: 0.9,
        diagnostics: [],
        suggestedSection: type === 'reference' ? 'References' : 'Content',
      });

      if (type === 'caption' && /^(fig(?:ure)?\.?\s*\d+|diagram\s*\d+)/i.test(line.text)) {
        figures.push({
          id: `fig-${++figureCount}`,
          imageData: createFigurePlaceholder(line.text || `Figure ${figureCount}`),
          caption: line.text,
          page: i,
          bbox: { x: line.x, y: line.y, width: line.width, height: line.height },
          confidence: 0.65,
          diagnostics: [
            {
              level: 'warning',
              code: 'CAPTION_LINK_UNCERTAIN',
              message: `Figure caption detected on page ${i}; review association before commit.`,
            },
          ],
        });
      }

      if (type === 'table') {
        const matrix = tableRowToMatrix(line.text);
        tables.push({
          id: `tbl-${++tableCount}`,
          html: tableMatrixToHtml(matrix),
          matrix,
          caption: undefined,
          page: i,
          bbox: { x: line.x, y: line.y, width: line.width, height: line.height },
          confidence: matrix.length > 0 && (matrix[0]?.length || 0) > 1 ? 0.72 : 0.5,
          diagnostics: [
            {
              level: 'warning',
              code: 'TABLE_GRID_UNCERTAIN',
              message: `Table-like content detected on page ${i}; review required.`,
            },
          ],
        });
      }
    }
  }

  return {
    text: pages.join('\n\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    blocks,
    figures,
    tables,
    diagnostics,
  };
}

async function parseLocally(file: File): Promise<RawParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const [result, textResult] = await Promise.all([
      mammoth.convertToHtml({ arrayBuffer }),
      mammoth.extractRawText({ arrayBuffer }),
    ]);
    return {
      fileTitle: file.name.replace(/\.docx$/i, ''),
      format: 'docx',
      html: result.value,
      text: textResult.value,
      references: extractReferencesFromOupHtml(result.value),
      diagnostics: (result.messages || []).map((item) => ({
        level: 'warning' as const,
        code: 'DOCX_PARSE_WARNING',
        message: item.message,
      })),
    };
  }

  if (extension === 'pdf') {
    const extracted = await extractPdfTextInBrowser(await file.arrayBuffer());
    return {
      fileTitle: file.name.replace(/\.pdf$/i, ''),
      format: 'pdf',
      text: extracted.text,
      blocks: extracted.blocks,
      figures: extracted.figures,
      tables: extracted.tables,
      links: [],
      diagnostics: extracted.text
        ? extracted.diagnostics
        : [
            {
              level: 'warning',
              code: 'PDF_EMPTY_TEXT',
              message: 'No extractable text was detected in this PDF.',
            },
            ...extracted.diagnostics,
          ],
    };
  }

  if (extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'gif' || extension === 'webp') {
    const mime = file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const chunkSize = 0x8000;
    let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)));
  }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;
    return {
      fileTitle: file.name.replace(/\.[^.]+$/, ''),
      format: 'image',
      imageDataUrl: dataUrl,
      diagnostics: [],
    };
  }

  throw new Error('Unsupported file format');
}

async function importFile(file: File): Promise<ImportDocumentResult> {
  const raw = (await parseViaServer(file)) ?? (await parseLocally(file));
  const parsed = await parseWithWorker(raw);
  const diagnostics = [...parsed.diagnostics];

  // Use sanitized filename as title, with date-based fallback for empty names
  const rawTitle = parsed.fileTitle || file.name || `Imported Manuscript - ${new Date().toISOString().split('T')[0]}`;
  const title = sanitizeFilename(rawTitle);

  // Ensure we always have at least one section
  let sections = parsed.sections.map((section) => ({
    title: normalizePlainImportedText(section.title, { trim: true }),
    content: normalizeImportedHtml(section.content),
  }));

  // If no sections were parsed, create a default section with all available content
  if (sections.length === 0) {
    const fallbackContent = raw.html || (raw.text ? `<p>${normalizePlainImportedText(raw.text)}</p>` : '<p></p>');
    sections = [{
      title: 'Content',
      content: fallbackContent,
    }];
    diagnostics.push({
      level: 'info',
      code: 'NO_SECTIONS_PARSED',
      message: 'No section headings were detected. All content has been placed in a single "Content" section.',
    });
  }

  const citations: CitationFormData[] = parsed.citations.map((citation) => ({
    authors: citation.authors.map((author) => normalizePlainImportedText(author, { trim: true })),
    title: normalizePlainImportedText(citation.title, { trim: true }),
    year: citation.year,
    journal: citation.journal ? normalizePlainImportedText(citation.journal, { trim: true }) : undefined,
    doi: citation.doi ? normalizePlainImportedText(citation.doi, { trim: true }) : undefined,
    url: citation.url ? normalizePlainImportedText(citation.url, { trim: true }) : undefined,
    type: citation.type,
    freePdfUrl: undefined,
    oaStatus: undefined,
  }));

  const artifactValues = [
    title,
    ...sections.flatMap((section) => [section.title || '', section.content || '']),
    ...citations.flatMap((citation) => [
      citation.title || '',
      citation.journal || '',
      citation.doi || '',
      citation.url || '',
      ...citation.authors,
    ]),
  ];
  if (hasAnyEncodingArtifacts(artifactValues)) {
    diagnostics.push({
      level: 'warning',
      code: 'ENCODING_REVIEW_RECOMMENDED',
      message: 'Some imported text may still contain encoding artifacts. Please review punctuation and symbols.',
    });
  }

  const statusInfo = deriveImportStatus(raw, diagnostics, Boolean(parsed.reviewRequired));
  // Pass the final `sections` (which includes the fallback "Content" section if none were parsed)
  // rather than `parsed.sections` which may be empty before the fallback is applied.
  const parsedWithFinalSections = { ...parsed, sections };
  const items =
    raw.format === 'docx' || (raw.llmParsed && raw.llmParsed.sections.length > 0)
      ? buildDocxImportItems(raw, parsedWithFinalSections)
      : raw.format === 'pdf'
        ? buildPdfImportItems(parsed)
        : buildImageImportItems(raw);

  return {
    fileName: file.name,
    sourceFormat: raw.format,
    title,
    sections,
    citations,
    diagnostics,
    totalWordCount: parsed.totalWordCount,
    status: statusInfo.status,
    unsupportedReason: statusInfo.unsupportedReason,
    items,
    review: {
      required: Boolean(parsed.reviewRequired),
      blocks: parsed.blocks || [],
      figures: parsed.figures || [],
      tables: parsed.tables || [],
      links: parsed.links || [],
    },
  };
}

export async function importDocx(file: File): Promise<ImportDocumentResult> {
  return importFile(file);
}

export async function importPdf(file: File): Promise<ImportDocumentResult> {
  return importFile(file);
}

export async function importImage(file: File): Promise<ImportDocumentResult> {
  return importFile(file);
}

export async function exportToDocx(manuscript: Manuscript): Promise<void> {
  const { default: HTMLtoDOCX } = await import('html-to-docx');
  const html = buildFullHtml(manuscript);

  const blob = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  });

  downloadBlob(blob as Blob, `${sanitizeFilename(manuscript.title)}.docx`);
}

export async function exportToPdf(manuscript: Manuscript): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const container = document.createElement('div');
  container.innerHTML = buildFullHtml(manuscript);
  const bodyContent = container.querySelector('body');

  const wrapper = document.createElement('div');
  wrapper.style.width = '794px';
  wrapper.style.padding = '48px';
  wrapper.style.fontFamily = "'Times New Roman', serif";
  wrapper.style.fontSize = '12pt';
  wrapper.style.lineHeight = '1.6';
  wrapper.style.color = '#111';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = bodyContent?.innerHTML || container.innerHTML;

  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(`${sanitizeFilename(manuscript.title)}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}
