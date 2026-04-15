import { describe, expect, it } from "vitest";
import {
  buildFitScore,
  buildFitReasons,
  normalizeScoreComponents,
} from "../journal-recommend.service";

interface ScoringInput {
  similarity: number;
  impactFactorNorm: number;
  acceptanceRate: number;
  avgDecisionDaysNorm: number;
}

describe("buildFitScore", () => {
  const input: ScoringInput = {
    similarity: 0.85,
    impactFactorNorm: 0.6,
    acceptanceRate: 0.2,
    avgDecisionDaysNorm: 0.7,
  };

  it("auto mode weights similarity 0.6, speed 0.2, acceptance 0.2", () => {
    const score = buildFitScore(input, "auto");
    expect(score).toBeCloseTo(0.85 * 0.6 + 0.7 * 0.2 + 0.2 * 0.2, 4);
  });

  it("impact mode weights similarity 0.6, impact 0.35, acceptance 0.05", () => {
    const score = buildFitScore(input, "impact");
    expect(score).toBeCloseTo(0.85 * 0.6 + 0.6 * 0.35 + 0.2 * 0.05, 4);
  });

  it("odds mode weights similarity 0.6, impact 0.1, acceptance 0.3", () => {
    const score = buildFitScore(input, "odds");
    expect(score).toBeCloseTo(0.85 * 0.6 + 0.6 * 0.1 + 0.2 * 0.3, 4);
  });
});

describe("buildFitReasons", () => {
  it("includes strong subject match reason for high similarity", () => {
    const reasons = buildFitReasons({
      similarity: 0.85,
      subjectAreas: ["Cardiology"],
      wordCountInRange: true,
      openAccess: false,
      mode: "auto",
    });
    expect(reasons).toContain("Strong subject match");
  });

  it("includes word count reason when in range", () => {
    const reasons = buildFitReasons({
      similarity: 0.7,
      subjectAreas: [],
      wordCountInRange: true,
      openAccess: false,
      mode: "auto",
    });
    expect(reasons).toContain("Word count within journal limits");
  });

  it("includes open access label", () => {
    const reasons = buildFitReasons({
      similarity: 0.7,
      subjectAreas: [],
      wordCountInRange: false,
      openAccess: true,
      mode: "auto",
    });
    expect(reasons).toContain("Open access");
  });
});

describe("normalizeScoreComponents", () => {
  it("normalises values to [0, 1] range", () => {
    const values = [10, 20, 30, 40, 50];
    const normalized = normalizeScoreComponents(values);
    expect(normalized[0]).toBe(0);
    expect(normalized[4]).toBe(1);
    expect(normalized[2]).toBeCloseTo(0.5, 4);
  });

  it("returns all 0.5 when all values are equal", () => {
    const normalized = normalizeScoreComponents([5, 5, 5]);
    expect(normalized).toEqual([0.5, 0.5, 0.5]);
  });
});
