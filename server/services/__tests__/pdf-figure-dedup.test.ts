import { describe, expect, it } from "vitest";
import { deduplicateFiguresByObjId } from "../manuscript-parse.service";
import type { ParsedFigure } from "../../../shared/document-parse";

function makeFigure(id: string, objId: string | undefined, imageData = "data:image/png;base64,abc"): ParsedFigure {
  return { id, imageData, page: 1, confidence: 0.95, diagnostics: [], objId };
}

describe("deduplicateFiguresByObjId", () => {
  it("keeps all figures when no objId duplicates exist", () => {
    const figures = [
      makeFigure("f1", "img1"),
      makeFigure("f2", "img2"),
      makeFigure("f3", "img3"),
    ];
    expect(deduplicateFiguresByObjId(figures)).toHaveLength(3);
  });

  it("removes second occurrence of same objId, keeps first", () => {
    const figures = [
      makeFigure("f1", "img1"),
      makeFigure("f2", "img1"), // duplicate
      makeFigure("f3", "img2"),
    ];
    const result = deduplicateFiguresByObjId(figures);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("f1");
    expect(result[1].id).toBe("f3");
  });

  it("keeps figures with undefined objId — they cannot be deduplicated by ID", () => {
    const figures = [
      makeFigure("f1", undefined),
      makeFigure("f2", undefined),
    ];
    expect(deduplicateFiguresByObjId(figures)).toHaveLength(2);
  });

  it("handles mix of known and unknown objIds correctly", () => {
    const figures = [
      makeFigure("f1", "img1"),
      makeFigure("f2", undefined),
      makeFigure("f3", "img1"), // duplicate of f1
      makeFigure("f4", undefined),
    ];
    const result = deduplicateFiguresByObjId(figures);
    expect(result).toHaveLength(3); // f1, f2, f4 (f3 removed as dup of f1)
    expect(result.map((f) => f.id)).toEqual(["f1", "f2", "f4"]);
  });
});
