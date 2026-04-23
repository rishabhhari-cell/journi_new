import { describe, expect, it } from "vitest";
import { bboxFromTransformOrImageFallback } from "../manuscript-parse.service";

describe("bboxFromTransformOrImageFallback", () => {
  it("returns transform-derived bbox when it passes the size check", () => {
    // A scale matrix [200, 0, 0, 150, 50, 80] → width=200, height=150
    const matrix = [200, 0, 0, 150, 50, 80];
    const result = bboxFromTransformOrImageFallback(matrix, 400, 300, 612, 792);
    expect(result.width).toBeCloseTo(200);
    expect(result.height).toBeCloseTo(150);
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(80);
  });

  it("falls back to image pixel dimensions when transform yields sub-threshold bbox", () => {
    // Identity matrix → bbox 1×1 → fails size check → fall back to imgW×imgH
    const identityMatrix = [1, 0, 0, 1, 0, 0];
    const result = bboxFromTransformOrImageFallback(identityMatrix, 640, 480, 612, 792);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
  });

  it("falls back when transform yields a tiny 1×1 unit square (identity before scale)", () => {
    const identityMatrix = [1, 0, 0, 1, 100, 200];
    const result = bboxFromTransformOrImageFallback(identityMatrix, 800, 600, 612, 792);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it("uses transform when scale is clearly large enough (typical figure transform)", () => {
    // [0.5, 0, 0, 0.5, ...] scaled by 400px image → effective 200×200 bbox
    const scaleMatrix = [200, 0, 0, 200, 10, 10];
    const result = bboxFromTransformOrImageFallback(scaleMatrix, 400, 400, 612, 792);
    expect(result.width).toBeCloseTo(200);
    expect(result.height).toBeCloseTo(200);
  });
});
