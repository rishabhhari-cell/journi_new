import { describe, expect, it } from "vitest";
import { extractDocxCaptionsFromHtml } from "../manuscript-parse.service";

describe("extractDocxCaptionsFromHtml", () => {
  it("extracts a Figure caption from a <p> paragraph", () => {
    const html = `<p>Figure 1. Kaplan-Meier survival curves for overall survival.</p>`;
    expect(extractDocxCaptionsFromHtml(html)).toEqual([
      { figureNumber: 1, text: "Figure 1. Kaplan-Meier survival curves for overall survival." },
    ]);
  });

  it("extracts a Fig. abbreviated caption", () => {
    const html = `<p>Fig. 2 Distribution of outcomes by arm.</p>`;
    expect(extractDocxCaptionsFromHtml(html)).toEqual([
      { figureNumber: 2, text: "Fig. 2 Distribution of outcomes by arm." },
    ]);
  });

  it("extracts a <figcaption> element", () => {
    const html = `<figure><img/><figcaption>Figure 3. Study design overview.</figcaption></figure>`;
    expect(extractDocxCaptionsFromHtml(html)).toEqual([
      { figureNumber: 3, text: "Figure 3. Study design overview." },
    ]);
  });

  it("extracts multiple captions in document order", () => {
    const html = `
      <p>Figure 1. First caption.</p>
      <p>Some body text.</p>
      <p>Figure 2. Second caption.</p>
    `;
    const result = extractDocxCaptionsFromHtml(html);
    expect(result).toHaveLength(2);
    expect(result[0].figureNumber).toBe(1);
    expect(result[1].figureNumber).toBe(2);
  });

  it("ignores table captions (Table N.)", () => {
    const html = `
      <p>Table 1. Summary statistics.</p>
      <p>Figure 1. Survival curves.</p>
    `;
    const result = extractDocxCaptionsFromHtml(html);
    expect(result).toHaveLength(1);
    expect(result[0].figureNumber).toBe(1);
  });

  it("returns empty array when no figure captions present", () => {
    const html = `<p>This is just body text.</p><p>Another paragraph.</p>`;
    expect(extractDocxCaptionsFromHtml(html)).toEqual([]);
  });
});
