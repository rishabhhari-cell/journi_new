import { describe, expect, it } from "vitest";
import {
  containsLikelyEncodingArtifacts,
  normalizePlainImportedText,
} from "@/lib/import-normalization";

describe("normalizePlainImportedText", () => {
  it("decodes HTML entities", () => {
    expect(normalizePlainImportedText("A &amp; B &quot;quoted&quot; &#39;text&#39;"))
      .toBe('A & B "quoted" \'text\'');
  });

  it("decodes double-encoded entities", () => {
    expect(normalizePlainImportedText("Tom &amp;amp; Jerry &amp;quot;pilot&amp;quot;"))
      .toBe('Tom & Jerry "pilot"');
  });

  it("replaces non-breaking spaces with regular spaces", () => {
    expect(normalizePlainImportedText("hello\u00A0world")).toBe("hello world");
  });

  it("strips BOM characters", () => {
    expect(normalizePlainImportedText("\uFEFFhello")).toBe("hello");
  });
});

describe("containsLikelyEncodingArtifacts", () => {
  it("detects common mojibake patterns", () => {
    // \u00E2\u20AC followed by any char is a Windows-1252 mojibake signature
    expect(containsLikelyEncodingArtifacts("\u00E2\u20AC\u2122")).toBe(true);
    // \u00C3 followed by any char (Latin-1 mojibake for accented chars)
    expect(containsLikelyEncodingArtifacts("\u00C3\u00A9")).toBe(true);
    // replacement character
    expect(containsLikelyEncodingArtifacts("hello \uFFFD world")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(containsLikelyEncodingArtifacts("Hello world")).toBe(false);
    expect(containsLikelyEncodingArtifacts("Smith\u2019s")).toBe(false);
  });
});
