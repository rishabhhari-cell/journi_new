import { describe, expect, it } from "vitest";
import {
  containsLikelyEncodingArtifacts,
  normalizeImportedHtml,
  normalizePlainImportedText,
} from "@/lib/import-normalization";

describe("normalizePlainImportedText", () => {
  it("repairs common mojibake punctuation", () => {
    expect(normalizePlainImportedText("Smithâ€™s “trial” â€“ phase 2")).toBe("Smith�s �trial� � phase 2");
  });

  it("decodes HTML entities safely for plain text", () => {
    expect(normalizePlainImportedText("A &amp; B &quot;quoted&quot; &#39;text&#39;"))
      .toBe(`A & B "quoted" 'text'`);
  });

  it("decodes double-encoded entities", () => {
    expect(normalizePlainImportedText("Tom &amp;amp; Jerry &amp;quot;pilot&amp;quot;"))
      .toBe('Tom & Jerry "pilot"');
  });
});

describe("normalizeImportedHtml", () => {
  it("preserves HTML structure while normalizing text nodes", () => {
    const html = "<p><strong>Tom &amp; Jerryâ€™s</strong> trial</p><ul><li>One&nbsp;item</li></ul>";
    const normalized = normalizeImportedHtml(html);

    expect(normalized).toContain("<strong>Tom &amp; Jerry�s</strong>");
    expect(normalized).toContain("<li>One item</li>");
    expect(normalized).toContain("<ul>");
  });
});

describe("containsLikelyEncodingArtifacts", () => {
  it("flags unresolved mojibake and ignores clean text", () => {
    expect(containsLikelyEncodingArtifacts("Smithâ€™s")).toBe(true);
    expect(containsLikelyEncodingArtifacts("Smith�s")).toBe(false);
  });
});
