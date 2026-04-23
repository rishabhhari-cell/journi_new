import { describe, expect, it } from "vitest";
import { isFigureSized } from "../manuscript-parse.service";

describe("isFigureSized", () => {
  it("accepts a typical figure (300×200)", () => {
    expect(isFigureSized(300, 200, 612, 792)).toBe(true);
  });

  it("rejects a 1-pixel-tall horizontal rule (600×3)", () => {
    expect(isFigureSized(600, 3, 612, 792)).toBe(false);
  });

  it("rejects a 1-pixel-wide vertical rule (3×400)", () => {
    expect(isFigureSized(3, 400, 612, 792)).toBe(false);
  });

  it("rejects a tiny icon below the absolute minimum (20×20)", () => {
    expect(isFigureSized(20, 20, 612, 792)).toBe(false);
  });

  it("rejects a narrow-but-tall shape that fails the min-width check (5×200)", () => {
    expect(isFigureSized(5, 200, 612, 792)).toBe(false);
  });

  it("accepts a small-but-valid figure that meets both dimension and area floors (60×60)", () => {
    expect(isFigureSized(60, 60, 612, 792)).toBe(true);
  });

  it("rejects a wide-but-flat banner that has low area relative to a square of same width (400×5)", () => {
    expect(isFigureSized(400, 5, 612, 792)).toBe(false);
  });
});
