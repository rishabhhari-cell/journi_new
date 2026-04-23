import { describe, expect, it } from "vitest";
import { extractFigureNumber } from "../manuscript-parse.service";

describe("extractFigureNumber", () => {
  it("extracts number from 'Figure 1. ...'", () => {
    expect(extractFigureNumber("Figure 1. Kaplan-Meier survival curve.")).toBe(1);
  });

  it("extracts number from 'Fig. 3' abbreviated form", () => {
    expect(extractFigureNumber("Fig. 3 Distribution of outcomes.")).toBe(3);
  });

  it("extracts number from 'FIGURE 2' all-caps", () => {
    expect(extractFigureNumber("FIGURE 2. Study design overview.")).toBe(2);
  });

  it("returns null for a non-caption string", () => {
    expect(extractFigureNumber("This is a body paragraph.")).toBeNull();
  });

  it("returns null for a table caption", () => {
    expect(extractFigureNumber("Table 1. Summary statistics.")).toBeNull();
  });

  it("extracts number from 'Fig3' without space", () => {
    expect(extractFigureNumber("Fig3. Heatmap of correlation matrix.")).toBe(3);
  });
});
