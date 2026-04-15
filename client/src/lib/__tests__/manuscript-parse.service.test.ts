import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { encode as encodePng } from 'fast-png';
import JSZip from 'jszip';
import { parseUploadedDocument } from '../../../../server/services/manuscript-parse.service';

function createPngBuffer(): Buffer {
  const png = encodePng({
    width: 2,
    height: 2,
    data: new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 0, 255,
    ]),
    depth: 8,
    channels: 4,
  } as any);
  return Buffer.from(png);
}

async function createChartDocxBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
    </Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart1.xml"/>
    </Relationships>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
      <w:body>
        <w:p><w:r><w:t>Chart Import Test</w:t></w:r></w:p>
        <w:p><w:r><w:t>Abstract</w:t></w:r></w:p>
        <w:p><w:r><w:t>Short abstract.</w:t></w:r></w:p>
        <w:p>
          <w:r>
            <w:drawing>
              <wp:inline>
                <a:graphic>
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
                    <c:chart r:id="rId8"/>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
        <w:p><w:r><w:t>Figure 1: Chart caption.</w:t></w:r></w:p>
        <w:sectPr />
      </w:body>
    </w:document>`);
  zip.file('word/charts/chart1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <c:chart>
        <c:title>
          <c:tx>
            <c:rich>
              <a:p><a:r><a:t>Example Chart</a:t></a:r></a:p>
            </c:rich>
          </c:tx>
        </c:title>
        <c:plotArea>
          <c:barChart>
            <c:barDir val="bar"/>
            <c:ser>
              <c:idx val="0"/>
              <c:order val="0"/>
              <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>Series 1</c:v></c:pt></c:strCache></c:strRef></c:tx>
              <c:cat><c:strRef><c:strCache>
                <c:pt idx="0"><c:v>Alpha</c:v></c:pt>
                <c:pt idx="1"><c:v>Beta</c:v></c:pt>
              </c:strCache></c:strRef></c:cat>
              <c:val><c:numRef><c:numCache>
                <c:pt idx="0"><c:v>10</c:v></c:pt>
                <c:pt idx="1"><c:v>20</c:v></c:pt>
              </c:numCache></c:numRef></c:val>
            </c:ser>
          </c:barChart>
        </c:plotArea>
      </c:chart>
    </c:chartSpace>`);
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

describe('manuscript parse service', () => {
  it('extracts embedded figures from pdf images', async () => {
    const pdf = new jsPDF();
    const image = `data:image/png;base64,${createPngBuffer().toString('base64')}`;
    pdf.addImage(image, 'PNG', 10, 10, 60, 30);
    pdf.text('Figure 1: PDF figure caption', 10, 50);

    const parsed = await parseUploadedDocument({
      fileName: 'figure-test.pdf',
      buffer: Buffer.from(pdf.output('arraybuffer')),
    });

    expect(parsed.figures?.length).toBeGreaterThan(0);
    expect(parsed.figures?.[0].imageData.startsWith('data:image/')).toBe(true);
    expect(parsed.figures?.[0].caption).toContain('Figure 1');
  }, 20000);

  it('extracts embedded chart figures from docx packages', async () => {
    const parsed = await parseUploadedDocument({
      fileName: 'chart-test.docx',
      buffer: await createChartDocxBuffer(),
    });

    expect(parsed.figures?.length).toBe(1);
    expect(parsed.figures?.[0].imageData.startsWith('data:image/svg+xml;base64,')).toBe(true);
  }, 20000);
});
