import { describe, expect, it } from "vitest";
import { detectHeadingFromParagraphXml, extractTextFromParagraphXml } from "../docx-xml-parse.service";

describe("detectHeadingFromParagraphXml", () => {
  it("detects heading via w:outlineLvl", () => {
    const paraXml = `<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>Introduction</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(true);
  });

  it("detects heading via w:pStyle starting with Heading", () => {
    const paraXml = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(true);
  });

  it("does not flag normal body paragraph as heading", () => {
    const paraXml = `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>This is a body sentence.</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(false);
  });

  it("detects ALL-CAPS canonical alias as heading (last resort)", () => {
    const paraXml = `<w:p><w:r><w:t>METHODS</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(true);
  });
});

describe("extractTextFromParagraphXml", () => {
  it("concatenates all w:t runs", () => {
    const paraXml = `<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p>`;
    expect(extractTextFromParagraphXml(paraXml)).toBe("Hello world");
  });
});
