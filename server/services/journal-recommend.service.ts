import { supabaseAdmin } from "../lib/supabase";
import type { JournalDTO } from "../../shared/backend";
import { mapJournalRow } from "./journals/types";
import type { JournalRow } from "./journals/types";

export type RecommendMode = "auto" | "impact" | "odds";

export interface JournalRecommendation {
  journal: JournalDTO;
  fitScore: number;
  fitReasons: string[];
}

export interface RecommendFilters {
  mode: RecommendMode;
  openAccess?: boolean;
}

// ── Scoring helpers (exported for tests) ──────────────────────────────────

interface ScoringInput {
  similarity: number;
  impactFactorNorm: number;
  acceptanceRate: number;
  avgDecisionDaysNorm: number;
}

export function buildFitScore(input: ScoringInput, mode: RecommendMode): number {
  const { similarity, impactFactorNorm, acceptanceRate, avgDecisionDaysNorm } = input;
  switch (mode) {
    case "impact":
      return similarity * 0.6 + impactFactorNorm * 0.35 + acceptanceRate * 0.05;
    case "odds":
      return similarity * 0.6 + impactFactorNorm * 0.1 + acceptanceRate * 0.3;
    case "auto":
    default:
      return similarity * 0.6 + avgDecisionDaysNorm * 0.2 + acceptanceRate * 0.2;
  }
}

export function normalizeScoreComponents(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export function buildFitReasons(input: {
  similarity: number;
  subjectAreas: string[];
  wordCountInRange: boolean;
  openAccess: boolean;
  mode: RecommendMode;
  avgDecisionDaysNorm?: number;
}): string[] {
  const reasons: string[] = [];

  if (input.similarity >= 0.8) reasons.push("Strong subject match");
  else if (input.similarity >= 0.6) reasons.push("Good subject match");
  else reasons.push("Moderate subject match");

  if (input.subjectAreas.length > 0) {
    reasons.push(`Subject areas: ${input.subjectAreas.slice(0, 2).join(", ")}`);
  }

  if (input.wordCountInRange) reasons.push("Word count within journal limits");
  if (input.openAccess) reasons.push("Open access");
  if (input.mode === "impact") reasons.push("High impact factor");
  if (input.mode === "odds") reasons.push("Above-average acceptance rate");
  if (input.mode === "auto" && (input.avgDecisionDaysNorm ?? 0) >= 0.7)
    reasons.push("Fast decision turnaround");

  return reasons;
}

// ── Main recommendation query ──────────────────────────────────────────────

export async function recommendJournals(params: {
  manuscriptId: string;
  manuscriptWordCount: number;
  filters: RecommendFilters;
}): Promise<JournalRecommendation[]> {
  // 1. Fetch manuscript embedding
  const { data: msData, error: msError } = await supabaseAdmin
    .from("manuscripts")
    .select("abstract_embedding")
    .eq("id", params.manuscriptId)
    .single();

  if (msError || !msData?.abstract_embedding) return [];

  const embedding = msData.abstract_embedding as number[];

  // 2. pgvector cosine similarity — top 50 candidates via RPC
  const { data: candidates, error: vecError } = await supabaseAdmin.rpc(
    "match_journals_by_embedding",
    {
      query_embedding: embedding,
      match_count: 50,
    },
  );

  if (vecError || !candidates) return [];

  // 3. Filter by open access preference
  let filtered = (candidates as Array<JournalRow & { similarity: number }>).filter((j) => {
    if (params.filters.openAccess === true) return j.open_access === true;
    if (params.filters.openAccess === false) return j.open_access !== true;
    return true;
  });

  // 4. Filter by word count — only exclude if journal has a limit AND manuscript exceeds it
  filtered = filtered.filter((j) => {
    const limits = (j.submission_requirements_json as Record<string, unknown> | null)
      ?.word_limits as Record<string, number> | undefined;
    if (!limits?.main_text) return true;
    return params.manuscriptWordCount <= limits.main_text;
  });

  // 5. Normalise score components across the candidate set
  const impactValues = filtered.map((j) => j.impact_factor ?? 0);
  const decisionValues = filtered.map((j) => (j.avg_decision_days ? 1 / j.avg_decision_days : 0));
  const acceptanceValues = filtered.map((j) => j.acceptance_rate ?? 0);

  const impactNorm = normalizeScoreComponents(impactValues);
  const decisionNorm = normalizeScoreComponents(decisionValues);
  const acceptanceNorm = normalizeScoreComponents(acceptanceValues);

  // 6. Score and build reasons
  const scored: JournalRecommendation[] = filtered.map((j, i) => {
    const similarity = j.similarity;
    const scoringInput: ScoringInput = {
      similarity,
      impactFactorNorm: impactNorm[i],
      acceptanceRate: acceptanceNorm[i],
      avgDecisionDaysNorm: decisionNorm[i],
    };
    const fitScore = buildFitScore(scoringInput, params.filters.mode);

    const limits = (j.submission_requirements_json as Record<string, unknown> | null)
      ?.word_limits as Record<string, number> | undefined;
    const wordCountInRange = limits?.main_text
      ? params.manuscriptWordCount <= limits.main_text
      : false;

    const fitReasons = buildFitReasons({
      similarity,
      subjectAreas: j.subject_areas ?? [],
      wordCountInRange,
      openAccess: j.open_access === true,
      mode: params.filters.mode,
      avgDecisionDaysNorm: decisionNorm[i],
    });

    return { journal: mapJournalRow(j), fitScore, fitReasons };
  });

  // 7. Sort descending by fitScore, return top 10
  return scored.sort((a, b) => b.fitScore - a.fitScore).slice(0, 10);
}
