import { describe, expect, it } from "vitest";
import { extractDocxDrawingRelIds } from "../manuscript-parse.service";

describe("extractDocxDrawingRelIds", () => {
  it("extracts a:blip r:embed rel ID (DrawingML image)", () => {
    const xml = `<a:blip r:embed="rId3" xmlns:a="..." xmlns:r="..."/>`;
    expect(extractDocxDrawingRelIds(xml)).toEqual(["rId3"]);
  });

  it("extracts c:chart r:id rel ID (chart reference)", () => {
    const xml = `<c:chart r:id="rId7" xmlns:c="..." xmlns:r="..."/>`;
    expect(extractDocxDrawingRelIds(xml)).toEqual(["rId7"]);
  });

  it("extracts v:imagedata r:id rel ID (VML image — old DOCX format)", () => {
    const xml = `<v:imagedata r:id="rId5" o:title="figure1"/>`;
    expect(extractDocxDrawingRelIds(xml)).toEqual(["rId5"]);
  });

  it("extracts multiple different rel IDs from mixed document XML", () => {
    const xml = `
      <a:blip r:embed="rId2"/>
      <v:imagedata r:id="rId9" o:title="chart"/>
      <c:chart r:id="rId4"/>
    `;
    expect(extractDocxDrawingRelIds(xml)).toEqual(["rId2", "rId9", "rId4"]);
  });

  it("deduplicates rel IDs that appear more than once", () => {
    const xml = `<a:blip r:embed="rId1"/><a:blip r:embed="rId1"/>`;
    expect(extractDocxDrawingRelIds(xml)).toEqual(["rId1"]);
  });

  it("returns empty array when no drawing refs present", () => {
    const xml = `<w:p><w:r><w:t>Just text</w:t></w:r></w:p>`;
    expect(extractDocxDrawingRelIds(xml)).toEqual([]);
  });
});
