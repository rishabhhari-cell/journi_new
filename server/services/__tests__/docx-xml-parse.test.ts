import { describe, expect, it } from "vitest";
import { detectHeadingFromParagraphXml, extractTextFromParagraphXml, classifyPreambleLine } from "../docx-xml-parse.service";

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

describe("classifyPreambleLine", () => {
  it("classifies a typical author line", () => {
    expect(classifyPreambleLine("Smith J, Jones A, Patel R")).toBe("author");
  });

  it("strips superscript suffixes before classifying author", () => {
    expect(classifyPreambleLine("Smith J¹, Jones A², Patel R³")).toBe("author");
  });

  it("classifies a university affiliation as institution", () => {
    expect(classifyPreambleLine("¹Department of Medicine, Harvard University, Boston, MA")).toBe("institution");
  });

  it("classifies a hospital affiliation as institution", () => {
    expect(classifyPreambleLine("St. Mary's Hospital, London, UK")).toBe("institution");
  });

  it("does not classify a long body sentence as author or institution", () => {
    expect(classifyPreambleLine("This study investigated the effects of treatment on patient outcomes over 12 months.")).toBe("other");
  });

  it("does not classify abstract heading as author or institution", () => {
    expect(classifyPreambleLine("Abstract")).toBe("other");
  });

  // Single-author lines (no comma): a paper with one author should still be classified
  it("classifies a single author name as author", () => {
    expect(classifyPreambleLine("Jones AB")).toBe("author");
  });

  it("classifies single author with full first name as author", () => {
    expect(classifyPreambleLine("Alice Smith")).toBe("author");
  });

  it("classifies single author with superscript as author", () => {
    expect(classifyPreambleLine("Jones AB¹")).toBe("author");
  });

  // Plain-digit affiliation markers (e.g. "1Mayo Clinic, Rochester, MN")
  // These lack institution keywords but have a plain leading digit
  it("classifies plain-digit-prefixed affiliation without keyword as institution", () => {
    // "Mayo Clinic" has no institution keyword; the leading "1" is the only signal
    expect(classifyPreambleLine("1Mayo Clinic, Rochester, MN")).toBe("institution");
  });

  it("classifies plain-digit-prefixed affiliation with two-digit number as institution", () => {
    expect(classifyPreambleLine("12St. Jude Medical Center, Memphis, TN")).toBe("institution");
  });
});
