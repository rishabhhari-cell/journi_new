import crypto from "node:crypto";
import type { JournalGuidelinesDTO } from "../../shared/backend";
import type { ReformatSuggestion } from "../../shared/reformat";

interface SectionInput {
  id: string;
  title: string;
  contentHtml: string;
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  const aliases: Record<string, string[]> = {
    methods: ["methods", "materials and methods", "methodology"],
    "materials and methods": ["methods", "materials and methods", "methodology"],
    results: ["results", "results & synthesis"],
    discussion: ["discussion", "discussion and conclusion"],
    conclusion: ["conclusion", "conclusions"],
    abstract: ["abstract"],
    introduction: ["introduction", "background"],
    references: ["references", "bibliography"],
  };
  return (aliases[na] ?? [na]).includes(nb) || (aliases[nb] ?? [nb]).includes(na);
}

function makeId(): string {
  return crypto.randomUUID();
}

export function buildDeterministicChanges(
  sections: SectionInput[],
  guidelines: JournalGuidelinesDTO,
  _manuscriptId: string,
): ReformatSuggestion[] {
  const suggestions: ReformatSuggestion[] = [];
  const sectionOrder = guidelines.sectionOrder ?? [];
  const sectionsRequired = guidelines.sectionsRequired ?? [];

  // ── Reorder ───────────────────────────────────────────────────────────────
  const currentTitles = sections.map((s) => s.title);
  const expectedOrder = sectionOrder.filter((required) =>
    currentTitles.some((t) => titlesMatch(t, required)),
  );

  let isOutOfOrder = false;
  let lastPos = -1;
  for (const expected of expectedOrder) {
    const pos = currentTitles.findIndex((t) => titlesMatch(t, expected));
    if (pos < lastPos) {
      isOutOfOrder = true;
      break;
    }
    lastPos = pos;
  }

  if (isOutOfOrder) {
    suggestions.push({
      id: makeId(),
      type: "reorder",
      sectionId: "document",
      original: currentTitles.join(" → "),
      suggested: expectedOrder.join(" → "),
      reason: `Section order does not match ${guidelines.journalName} requirements (${expectedOrder.join(", ")}).`,
      source: "deterministic",
      autoAccepted: true,
    });
  }

  // ── Missing required sections (stubs) ─────────────────────────────────────
  for (const required of sectionsRequired) {
    const present = sections.some((s) => titlesMatch(s.title, required));
    if (!present) {
      suggestions.push({
        id: makeId(),
        type: "stub",
        sectionId: "document",
        original: "",
        suggested: `<p><em>[Add ${required} section]</em></p>`,
        reason: `${guidelines.journalName} requires a "${required}" section that is missing from this manuscript.`,
        source: "deterministic",
        autoAccepted: true,
      });
    }
  }

  // ── Missing required declarations (stubs) ─────────────────────────────────
  for (const declaration of guidelines.requiredDeclarations ?? []) {
    const present = sections.some((s) => titlesMatch(s.title, declaration));
    if (!present) {
      suggestions.push({
        id: makeId(),
        type: "stub",
        sectionId: "document",
        original: "",
        suggested: `<p><em>[Add ${declaration} statement]</em></p>`,
        reason: `${guidelines.journalName} requires a "${declaration}" declaration that is missing.`,
        source: "deterministic",
        autoAccepted: true,
      });
    }
  }

  // ── Citation style flag ───────────────────────────────────────────────────
  if (guidelines.citationStyle) {
    const refSection = sections.find((s) => titlesMatch(s.title, "References"));
    if (refSection) {
      suggestions.push({
        id: makeId(),
        type: "citation-style",
        sectionId: refSection.id,
        original: refSection.contentHtml,
        suggested: refSection.contentHtml,
        reason: `${guidelines.journalName} requires ${guidelines.citationStyle.toUpperCase()} citation style. Review and reformat references accordingly.`,
        source: "deterministic",
        autoAccepted: true,
      });
    }
  }

  return suggestions;
}

// ── LLM suggestions layer ─────────────────────────────────────────────────

function buildGuidelinesSummary(guidelines: JournalGuidelinesDTO): string {
  const parts: string[] = [];
  if (guidelines.wordLimits?.abstract)
    parts.push(`Abstract: max ${guidelines.wordLimits.abstract} words`);
  if (guidelines.wordLimits?.main_text)
    parts.push(`Main text: max ${guidelines.wordLimits.main_text} words`);
  if (guidelines.citationStyle) parts.push(`Citation style: ${guidelines.citationStyle}`);
  if (guidelines.structuredAbstract)
    parts.push(
      "Abstract must be structured (Background/Objective/Methods/Results/Conclusion)",
    );
  if (guidelines.sectionOrder?.length)
    parts.push(`Section order: ${guidelines.sectionOrder.join(", ")}`);
  if (guidelines.requiredDeclarations?.length)
    parts.push(`Required declarations: ${guidelines.requiredDeclarations.join(", ")}`);
  return parts.join("\n");
}

async function callModalReformat(
  sectionTitle: string,
  sectionContent: string,
  guidelinesSummary: string,
): Promise<Array<{ type: string; original: string; suggested: string; reason: string }>> {
  // MODAL_LLM_REFORMAT_URL is the /reformat endpoint URL.
  // Falls back to MODAL_LLM_URL for environments where the same container handles both routes.
  const url = process.env.MODAL_LLM_REFORMAT_URL ?? process.env.MODAL_LLM_URL;
  if (!url) return [];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section_title: sectionTitle,
        section_content: sectionContent.replace(/<[^>]+>/g, " ").trim(),
        guidelines_summary: guidelinesSummary,
        _auth: process.env.MODAL_TOKEN_SECRET,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: unknown[] };
    return Array.isArray(data.suggestions) ? (data.suggestions as Array<{ type: string; original: string; suggested: string; reason: string }>) : [];
  } catch {
    return [];
  }
}

export async function buildLlmSuggestions(
  sections: SectionInput[],
  guidelines: JournalGuidelinesDTO,
): Promise<ReformatSuggestion[]> {
  const guidelinesSummary = buildGuidelinesSummary(guidelines);

  // Parallel calls — one per section (skip references and title, no prose rewriting needed)
  const skipSections = new Set(["references", "title"]);
  const eligible = sections.filter((s) => !skipSections.has(normalizeTitle(s.title)));

  const results = await Promise.all(
    eligible.map(async (section) => {
      const raw = await callModalReformat(section.title, section.contentHtml, guidelinesSummary);
      return raw.map(
        (r): ReformatSuggestion => ({
          id: makeId(),
          type: r.type === "trim" || r.type === "restructure" ? r.type : "trim",
          sectionId: section.id,
          original: r.original ?? "",
          suggested: r.suggested ?? "",
          reason: r.reason ?? "",
          source: "llm",
          autoAccepted: false,
        }),
      );
    }),
  );

  return results.flat();
}
