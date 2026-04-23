import { describe, expect, it } from "vitest";
import { normalizePdfImageBytes } from "../manuscript-parse.service";

const KIND = { RGBA_32BPP: 1, RGB_24BPP: 2, GRAYSCALE_1BPP: 3 };

describe("normalizePdfImageBytes", () => {
  it("RGBA: output is exactly width*height*4 bytes even when source is oversized", () => {
    const width = 2;
    const height = 2;
    const oversized = new Uint8Array(width * height * 4 + 8).fill(200);
    const result = normalizePdfImageBytes(
      { width, height, kind: KIND.RGBA_32BPP, data: oversized },
      KIND,
    );
    expect(result.length).toBe(width * height * 4);
  });

  it("RGBA: output is exactly width*height*4 bytes when source is undersized (no overflow)", () => {
    const width = 4;
    const height = 4;
    const undersized = new Uint8Array(10).fill(128); // shorter than 4*4*4=64
    const result = normalizePdfImageBytes(
      { width, height, kind: KIND.RGBA_32BPP, data: undersized },
      KIND,
    );
    expect(result.length).toBe(width * height * 4);
    // bytes beyond the source must be zeroed — not garbage
    expect(result[63]).toBe(0);
  });

  it("RGBA: pixel values from source are preserved at exact positions", () => {
    const width = 1;
    const height = 1;
    const source = new Uint8Array([10, 20, 30, 255]);
    const result = normalizePdfImageBytes(
      { width, height, kind: KIND.RGBA_32BPP, data: source },
      KIND,
    );
    expect(Array.from(result)).toEqual([10, 20, 30, 255]);
  });

  it("RGB: converts 3-byte pixels to 4-byte RGBA with alpha=255", () => {
    const width = 2;
    const height = 1;
    const source = new Uint8Array([255, 0, 0, 0, 255, 0]); // red, green
    const result = normalizePdfImageBytes(
      { width, height, kind: KIND.RGB_24BPP, data: source },
      KIND,
    );
    expect(result.length).toBe(8);
    expect(Array.from(result)).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
  });

  it("GRAYSCALE: output is width*height*4 bytes with correct bit expansion", () => {
    // 2×1 image: byte 0b10000000 → pixel0=black(0), pixel1=white(255)
    const source = new Uint8Array([0b10000000]);
    const result = normalizePdfImageBytes(
      { width: 2, height: 1, kind: KIND.GRAYSCALE_1BPP, data: source },
      KIND,
    );
    expect(result.length).toBe(8);
    // bit 7 set → black (value 0)
    expect(result[0]).toBe(0);
    // bit 6 clear → white (value 255)
    expect(result[4]).toBe(255);
  });

  it("unknown kind: returns zeroed buffer of correct length", () => {
    const result = normalizePdfImageBytes(
      { width: 3, height: 3, kind: 99, data: new Uint8Array(9).fill(7) },
      KIND,
    );
    expect(result.length).toBe(3 * 3 * 4);
    expect(result.every((b) => b === 0)).toBe(true);
  });
});
