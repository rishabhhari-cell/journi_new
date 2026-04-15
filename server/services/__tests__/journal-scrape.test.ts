import { describe, expect, it } from "vitest";
import {
  extractGuidelinesFromHtml,
  extractLogoFromHtml,
  extractAcceptanceRate,
  extractMeanTimeToPublication,
} from "../journals/scrape.service";

const SAMPLE_GUIDELINES_HTML = `
<html><body>
<h2>Word Limits</h2>
<p>Original articles should not exceed <strong>3500 words</strong> (excluding abstract and references).
Abstracts must not exceed <strong>250 words</strong>.</p>
<h2>Reference Style</h2>
<p>References should follow <strong>Vancouver</strong> style, numbered consecutively.</p>
<h2>Required Sections</h2>
<p>All original articles must include: Introduction, Methods, Results, Discussion, References.</p>
<p>The acceptance rate for submitted manuscripts is approximately <strong>18%</strong>.</p>
<p>Average time from submission to first decision: <strong>6 weeks</strong>.</p>
</body></html>
`;

const SAMPLE_LOGO_HTML = `
<html>
<head>
  <link rel="icon" href="/favicon.ico" />
  <meta property="og:image" content="https://example-journal.com/logo.png" />
</head>
<body></body>
</html>
`;

describe("extractGuidelinesFromHtml", () => {
  it("extracts main text word limit", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect((result.fields.word_limits as any)?.main_text).toBe(3500);
  });

  it("extracts abstract word limit", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect((result.fields.word_limits as any)?.abstract).toBe(250);
  });

  it("extracts citation style", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect(result.fields.citation_style).toBe("vancouver");
  });

  it("extracts required sections", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect(result.fields.sections_required).toContain("Methods");
  });

  it("returns low confidence when no fields found", () => {
    const result = extractGuidelinesFromHtml(
      "<html><body><p>No useful info here.</p></body></html>",
    );
    expect(result.confidence).toBeLessThan(3);
  });

  it("returns confidence ≥3 for well-structured page", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect(result.confidence).toBeGreaterThanOrEqual(3);
  });
});

describe("extractLogoFromHtml", () => {
  it("prefers og:image over favicon", () => {
    const logo = extractLogoFromHtml(SAMPLE_LOGO_HTML, "https://example-journal.com");
    expect(logo).toBe("https://example-journal.com/logo.png");
  });

  it("falls back to favicon when no og:image", () => {
    const html = `<html><head><link rel="icon" href="/favicon.ico" /></head></html>`;
    const logo = extractLogoFromHtml(html, "https://example-journal.com");
    expect(logo).toBe("https://example-journal.com/favicon.ico");
  });

  it("returns null when no logo found", () => {
    const logo = extractLogoFromHtml("<html><body></body></html>", "https://example-journal.com");
    expect(logo).toBeNull();
  });
});

describe("extractAcceptanceRate", () => {
  it("parses percentage from text", () => {
    expect(extractAcceptanceRate("acceptance rate is approximately 18%")).toBe(0.18);
  });

  it("returns null when no percentage found", () => {
    expect(extractAcceptanceRate("no rate info here")).toBeNull();
  });
});

describe("extractMeanTimeToPublication", () => {
  it("parses weeks to days", () => {
    expect(extractMeanTimeToPublication("average time to first decision: 6 weeks")).toBe(42);
  });

  it("parses days directly", () => {
    expect(extractMeanTimeToPublication("decision within 30 days")).toBe(30);
  });

  it("returns null when not found", () => {
    expect(extractMeanTimeToPublication("no timing info")).toBeNull();
  });
});
