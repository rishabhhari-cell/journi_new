/**
 * Document Import/Export Utilities
 * Supports DOCX and PDF import/export for the manuscript editor
 */
import type { DocumentSection, Manuscript } from '@/types';

// ============================================================================
// Export: Combine all sections into a single HTML document
// ============================================================================

function buildFullHtml(manuscript: Manuscript): string {
  const sectionsHtml = manuscript.sections
    .map((s) => `<h1>${s.title}</h1>\n${s.content || '<p></p>'}`)
    .join('\n');

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
          code { font-family: 'Courier New', monospace; background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
          pre { background: #f0f0f0; padding: 12pt; border-radius: 6px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1 style="font-size: 24pt; text-align: center; margin-bottom: 24pt;">${manuscript.title}</h1>
        ${sectionsHtml}
      </body>
    </html>
  `.trim();
}

// ============================================================================
// Export to DOCX
// ============================================================================

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

// ============================================================================
// Export to PDF
// ============================================================================

export async function exportToPdf(manuscript: Manuscript): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  // Create an off-screen container with the full document
  const container = document.createElement('div');
  container.innerHTML = buildFullHtml(manuscript);
  // Extract just the body content and apply styles inline
  const bodyContent = container.querySelector('body');
  const wrapper = document.createElement('div');
  wrapper.style.width = '794px'; // A4 width at 96 DPI
  wrapper.style.padding = '48px';
  wrapper.style.fontFamily = "'Times New Roman', serif";
  wrapper.style.fontSize = '12pt';
  wrapper.style.lineHeight = '1.6';
  wrapper.style.color = '#111';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = bodyContent?.innerHTML || container.innerHTML;

  // Style tables, headings, etc.
  wrapper.querySelectorAll('h1').forEach((el) => {
    (el as HTMLElement).style.fontSize = '18pt';
    (el as HTMLElement).style.fontWeight = 'bold';
    (el as HTMLElement).style.marginTop = '24pt';
    (el as HTMLElement).style.marginBottom = '8pt';
  });
  wrapper.querySelectorAll('table').forEach((el) => {
    (el as HTMLElement).style.borderCollapse = 'collapse';
    (el as HTMLElement).style.width = '100%';
  });
  wrapper.querySelectorAll('td, th').forEach((el) => {
    (el as HTMLElement).style.border = '1px solid #ccc';
    (el as HTMLElement).style.padding = '6px 8px';
  });

  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

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

// ============================================================================
// Import DOCX → HTML sections
// ============================================================================

export async function importDocx(file: File): Promise<{ title: string; sections: Partial<DocumentSection>[] }> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  return parseHtmlToSections(html, file.name.replace(/\.docx$/i, ''));
}

// ============================================================================
// Import PDF → text sections
// ============================================================================

export async function importPdf(file: File): Promise<{ title: string; sections: Partial<DocumentSection>[] }> {
  // Use PDF.js via a simple text extraction approach
  // Since pdfjs-dist is heavy, we'll use a lighter approach: read as text via the browser's FileReader
  // and parse structure, or use a canvas-free approach

  // For a cleaner solution, we dynamically load pdf.js from CDN
  const arrayBuffer = await file.arrayBuffer();

  // Try to use the pdfjsLib if available, otherwise fall back to basic text extraction
  const text = await extractPdfText(arrayBuffer);
  const title = file.name.replace(/\.pdf$/i, '');

  // Split by what looks like section headings (all-caps lines or lines followed by double newlines)
  const sections = parseTextToSections(text, title);
  return { title, sections };
}

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  // Dynamically load pdf.js from CDN
  if (!(window as any).pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const pdfjsLib = (window as any).pdfjsLib;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ============================================================================
// HTML → Sections parser
// ============================================================================

function parseHtmlToSections(
  html: string,
  fallbackTitle: string
): { title: string; sections: Partial<DocumentSection>[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild!;

  const sections: Partial<DocumentSection>[] = [];
  let currentTitle = '';
  let currentContent = '';
  let docTitle = fallbackTitle;

  // Walk through child nodes
  for (const node of Array.from(container.children)) {
    const tag = node.tagName.toLowerCase();

    if (tag === 'h1' || tag === 'h2') {
      // Save previous section
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.trim() });
      } else if (currentContent.trim()) {
        // Content before first heading becomes the first section
        sections.push({ title: 'Introduction', content: currentContent.trim() });
      }

      // If this is the very first h1 and no sections yet, treat it as the document title
      if (tag === 'h1' && sections.length === 0 && !currentTitle) {
        docTitle = node.textContent?.trim() || fallbackTitle;
        currentTitle = '';
        currentContent = '';
        continue;
      }

      currentTitle = node.textContent?.trim() || 'Untitled Section';
      currentContent = '';
    } else {
      currentContent += node.outerHTML + '\n';
    }
  }

  // Push last section
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.trim() });
  } else if (currentContent.trim()) {
    sections.push({ title: 'Content', content: currentContent.trim() });
  }

  // If no sections were found, put everything in one section
  if (sections.length === 0) {
    sections.push({ title: 'Content', content: html });
  }

  return { title: docTitle, sections };
}

// ============================================================================
// Plain text → Sections parser (for PDF import)
// ============================================================================

function parseTextToSections(
  text: string,
  fallbackTitle: string
): Partial<DocumentSection>[] {
  const lines = text.split('\n');
  const sections: Partial<DocumentSection>[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  // Common academic section headings
  const sectionHeadings = new Set([
    'abstract', 'introduction', 'background', 'methods', 'methodology',
    'materials and methods', 'results', 'discussion', 'conclusion', 'conclusions',
    'references', 'bibliography', 'acknowledgements', 'acknowledgments',
    'appendix', 'supplementary', 'literature review', 'related work',
    'future work', 'limitations',
  ]);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentLines.push('');
      continue;
    }

    // Detect headings: all-caps short lines, or known section names
    const isHeading =
      (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) ||
      sectionHeadings.has(trimmed.toLowerCase());

    if (isHeading) {
      if (currentTitle || currentLines.some((l) => l.trim())) {
        const content = currentLines
          .join('\n')
          .split('\n\n')
          .filter((p) => p.trim())
          .map((p) => `<p>${p.trim()}</p>`)
          .join('\n');
        sections.push({
          title: currentTitle || 'Introduction',
          content,
        });
      }
      currentTitle =
        trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      currentLines = [];
    } else {
      currentLines.push(trimmed);
    }
  }

  // Push last section
  if (currentTitle || currentLines.some((l) => l.trim())) {
    const content = currentLines
      .join('\n')
      .split('\n\n')
      .filter((p) => p.trim())
      .map((p) => `<p>${p.trim()}</p>`)
      .join('\n');
    sections.push({
      title: currentTitle || 'Content',
      content,
    });
  }

  if (sections.length === 0) {
    sections.push({ title: 'Content', content: `<p>${text}</p>` });
  }

  return sections;
}

// ============================================================================
// Helpers
// ============================================================================

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
