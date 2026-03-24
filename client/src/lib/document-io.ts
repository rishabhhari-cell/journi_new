/**
 * Document Import/Export Utilities
 * - Robust DOCX/PDF import with server-assisted parsing + worker normalization
 * - Deterministic DOCX/PDF export from canonical manuscript HTML
 */
import type { CitationFormData, DocumentSection, Manuscript } from '@/types';
import type { ParseDiagnostic, ParsedManuscript, RawParsedDocument } from '@shared/document-parse';
import { parseManuscriptUpload } from '@/lib/api/backend';

export interface ImportDocumentResult {
  title: string;
  sections: Partial<DocumentSection>[];
  citations: CitationFormData[];
  diagnostics: ParseDiagnostic[];
  totalWordCount: number;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'manuscript';
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
    binary += String.fromCharCode(...chunk);
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

async function extractPdfTextInBrowser(arrayBuffer: ArrayBuffer): Promise<string> {
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

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str?: string }>).map((item) => item.str || '').join(' ');
    pages.push(text);
  }

  return pages.join('\n\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function parseLocally(file: File): Promise<RawParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return {
      fileTitle: file.name.replace(/\.docx$/i, ''),
      format: 'docx',
      html: result.value,
      references: extractReferencesFromOupHtml(result.value),
      diagnostics: (result.messages || []).map((item) => ({
        level: 'warning' as const,
        code: 'DOCX_PARSE_WARNING',
        message: item.message,
      })),
    };
  }

  if (extension === 'pdf') {
    const text = await extractPdfTextInBrowser(await file.arrayBuffer());
    return {
      fileTitle: file.name.replace(/\.pdf$/i, ''),
      format: 'pdf',
      text,
      diagnostics: text
        ? []
        : [
            {
              level: 'warning',
              code: 'PDF_EMPTY_TEXT',
              message: 'No extractable text was detected in this PDF.',
            },
          ],
    };
  }

  throw new Error('Unsupported file format');
}

async function importFile(file: File): Promise<ImportDocumentResult> {
  const raw = (await parseViaServer(file)) ?? (await parseLocally(file));
  const parsed = await parseWithWorker(raw);

  return {
    title: parsed.fileTitle,
    sections: parsed.sections.map((section) => ({
      title: section.title,
      content: section.content,
    })),
    citations: parsed.citations.map((citation) => ({
      authors: citation.authors,
      title: citation.title,
      year: citation.year,
      journal: citation.journal,
      doi: citation.doi,
      url: citation.url,
      type: citation.type,
      freePdfUrl: undefined,
      oaStatus: undefined,
    })),
    diagnostics: parsed.diagnostics,
    totalWordCount: parsed.totalWordCount,
  };
}

export async function importDocx(file: File): Promise<ImportDocumentResult> {
  return importFile(file);
}

export async function importPdf(file: File): Promise<ImportDocumentResult> {
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
