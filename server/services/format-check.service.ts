import type {
  FormatCheckManualActionDTO,
  FormatCheckSafeActionDTO,
  FormatCheckUnsupportedDTO,
  ManuscriptFormatCheckDTO,
} from "../../shared/backend";
import { normalizeCitationStyle, SUPPORTED_CITATION_STYLES } from "../../shared/journal-requirements";
import { countWordsFromHtml } from "../../shared/word-count";
import type { JournalGuidelinesDTO } from "../../shared/backend";

interface FormatCheckSectionInput {
  id: string;
  title: string;
  contentHtml: string;
}

interface FormatCheckInput {
  manuscriptId: string;
  journalId: string;
  journalName: string;
  manuscriptSections: FormatCheckSectionInput[];
  manuscriptCitations: Array<{ id: string }>;
  journalGuidelines: JournalGuidelinesDTO;
}

const ABSTRACT_TEMPLATE = [
  "<p><strong>Background:</strong> <em>[Add background]</em></p>",
  "<p><strong>Objective:</strong> <em>[Add objective]</em></p>",
  "<p><strong>Methods:</strong> <em>[Add methods]</em></p>",
  "<p><strong>Results:</strong> <em>[Add results]</em></p>",
  "<p><strong>Conclusion:</strong> <em>[Add conclusion]</em></p>",
].join("");

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function titleMatches(sectionTitle: string, requiredTitle: string): boolean {
  const aliases: Record<string, string[]> = {
    methods: ["methods", "materials and methods", "methodology"],
    "materials and methods": ["materials and methods", "methods", "methodology"],
    results: ["results", "results & synthesis", "results and synthesis"],
    discussion: ["discussion", "discussion and conclusion"],
    conclusion: ["conclusion", "conclusions"],
    conclusions: ["conclusion", "conclusions"],
    abstract: ["abstract"],
    introduction: ["introduction", "background"],
    references: ["references", "bibliography"],
  };

  const required = normalizeTitle(requiredTitle);
  const actual = normalizeTitle(sectionTitle);
  const candidates = aliases[required] ?? [required];
  return candidates.includes(actual);
}

function hasStructuredAbstract(contentHtml: string): boolean {
  const lower = contentHtml.toLowerCase();
  return ["background", "objective", "methods", "results", "conclusion"].filter((label) =>
    lower.includes(`<strong>${label}:`) || lower.includes(`<strong>${label}</strong>`),
  ).length >= 3;
}

function buildMainTextWordCount(sections: FormatCheckSectionInput[]): number {
  return sections
    .filter((section) => {
      const title = normalizeTitle(section.title);
      return title !== "title" && title !== "abstract" && title !== "references";
    })
    .reduce((total, section) => total + countWordsFromHtml(section.contentHtml), 0);
}

export function buildManuscriptFormatCheck(input: FormatCheckInput): ManuscriptFormatCheckDTO {
  const safeAutoActions: FormatCheckSafeActionDTO[] = [];
  const manualActions: FormatCheckManualActionDTO[] = [];
  const unsupportedChecks: FormatCheckUnsupportedDTO[] = [];

  const sectionsRequired = input.journalGuidelines.sectionsRequired ?? [];
  const sectionOrder = input.journalGuidelines.sectionOrder ?? sectionsRequired;
  const citationStyle = normalizeCitationStyle(input.journalGuidelines.citationStyle);
  const titleSection = input.manuscriptSections.find((section) => normalizeTitle(section.title) === "title");
  const abstractSection = input.manuscriptSections.find((section) => normalizeTitle(section.title) === "abstract");

  for (const requiredTitle of sectionsRequired) {
    const existing = input.manuscriptSections.find((section) => titleMatches(section.title, requiredTitle));

    if (!existing) {
      safeAutoActions.push({
        id: `insert-${normalizeTitle(requiredTitle)}`,
        type: "insert_missing_section",
        severity: "required",
        sectionTitle: requiredTitle,
        description: `Add the required "${requiredTitle}" section.`,
        details: { targetTitle: requiredTitle },
      });
      continue;
    }

    if (normalizeTitle(existing.title) !== normalizeTitle(requiredTitle)) {
      safeAutoActions.push({
        id: `rename-${existing.id}`,
        type: "rename_heading",
        severity: "warning",
        sectionId: existing.id,
        sectionTitle: existing.title,
        description: `Rename "${existing.title}" to "${requiredTitle}" to match journal headings.`,
        details: { fromTitle: existing.title, toTitle: requiredTitle },
      });
    }
  }

  if (sectionOrder.length > 0) {
    safeAutoActions.push({
      id: "reorder-sections",
      type: "reorder_sections",
      severity: "warning",
      description: "Reorder manuscript sections to match the journal sequence.",
      details: { orderedTitles: sectionOrder },
    });
  }

  if (input.journalGuidelines.structuredAbstract && abstractSection && !hasStructuredAbstract(abstractSection.contentHtml)) {
    safeAutoActions.push({
      id: `structured-abstract-${abstractSection.id}`,
      type: "apply_structured_abstract_template",
      severity: "required",
      sectionId: abstractSection.id,
      sectionTitle: abstractSection.title,
      description: "Apply the journal's structured abstract template with empty labeled slots.",
      details: { templateHtml: ABSTRACT_TEMPLATE },
    });
  }

  const titleWordCount = titleSection ? countWordsFromHtml(titleSection.contentHtml) : 0;
  const abstractWordCount = abstractSection ? countWordsFromHtml(abstractSection.contentHtml) : 0;
  const totalWordCount = input.manuscriptSections.reduce(
    (total, section) => total + countWordsFromHtml(section.contentHtml),
    0,
  );
  const mainTextWordCount = buildMainTextWordCount(input.manuscriptSections);

  const limits = input.journalGuidelines.wordLimits;
  if (limits?.title && titleWordCount > limits.title) {
    manualActions.push({
      id: "title-word-limit",
      type: "word_limit_overrun",
      severity: "required",
      sectionTitle: "Title",
      description: `Title is ${titleWordCount} words and exceeds the ${limits.title}-word limit.`,
      details: { current: titleWordCount, limit: limits.title, scope: "title" },
    });
  }
  if (limits?.abstract && abstractWordCount > limits.abstract) {
    manualActions.push({
      id: "abstract-word-limit",
      type: "word_limit_overrun",
      severity: "required",
      sectionTitle: "Abstract",
      description: `Abstract is ${abstractWordCount} words and exceeds the ${limits.abstract}-word limit.`,
      details: { current: abstractWordCount, limit: limits.abstract, scope: "abstract" },
    });
  }
  if (limits?.main_text && mainTextWordCount > limits.main_text) {
    manualActions.push({
      id: "main-text-word-limit",
      type: "word_limit_overrun",
      severity: "required",
      description: `Main text is ${mainTextWordCount} words and exceeds the ${limits.main_text}-word limit.`,
      details: { current: mainTextWordCount, limit: limits.main_text, scope: "main_text" },
    });
  }
  if (limits?.total && totalWordCount > limits.total) {
    manualActions.push({
      id: "total-word-limit",
      type: "word_limit_overrun",
      severity: "required",
      description: `Manuscript is ${totalWordCount} words and exceeds the ${limits.total}-word limit.`,
      details: { current: totalWordCount, limit: limits.total, scope: "total" },
    });
  }

  const figureCount = input.manuscriptSections.reduce(
    (count, section) => count + (section.contentHtml.match(/<img\b/gi)?.length ?? 0),
    0,
  );
  const tableCount = input.manuscriptSections.reduce(
    (count, section) => count + (section.contentHtml.match(/<table\b/gi)?.length ?? 0),
    0,
  );

  if (input.journalGuidelines.figuresMax != null && figureCount > input.journalGuidelines.figuresMax) {
    manualActions.push({
      id: "figure-limit",
      type: "figure_limit_exceeded",
      severity: "required",
      description: `Manuscript has ${figureCount} figures and exceeds the journal limit of ${input.journalGuidelines.figuresMax}.`,
      details: { current: figureCount, limit: input.journalGuidelines.figuresMax },
    });
  }

  if (input.journalGuidelines.tablesMax != null && tableCount > input.journalGuidelines.tablesMax) {
    manualActions.push({
      id: "table-limit",
      type: "table_limit_exceeded",
      severity: "required",
      description: `Manuscript has ${tableCount} tables and exceeds the journal limit of ${input.journalGuidelines.tablesMax}.`,
      details: { current: tableCount, limit: input.journalGuidelines.tablesMax },
    });
  }

  if (input.journalGuidelines.keywordsRequired) {
    manualActions.push({
      id: "keywords-required",
      type: "keywords_required",
      severity: "warning",
      description: "Journal requires author keywords. Add them during final submission preparation.",
      details: { maxKeywords: input.journalGuidelines.maxKeywords },
    });
  }

  for (const declaration of input.journalGuidelines.requiredDeclarations ?? []) {
    manualActions.push({
      id: `declaration-${normalizeTitle(declaration).replace(/\s+/g, "-")}`,
      type: "required_declaration_missing",
      severity: "warning",
      description: `Confirm the required declaration: ${declaration}.`,
      details: { declaration },
    });
  }

  if (!citationStyle) {
    unsupportedChecks.push({
      id: "citation-style-unknown",
      code: "CITATION_STYLE_UNKNOWN",
      description: "Citation style could not be normalized from journal requirements.",
    });
  } else if (!SUPPORTED_CITATION_STYLES.has(citationStyle)) {
    unsupportedChecks.push({
      id: `citation-style-${citationStyle}`,
      code: "CITATION_STYLE_UNSUPPORTED",
      description: `Deterministic citation formatting for ${citationStyle.toUpperCase()} is not implemented yet.`,
    });
    manualActions.push({
      id: `citation-review-${citationStyle}`,
      type: "citation_style_review",
      severity: "warning",
      description: `References need manual review because ${citationStyle.toUpperCase()} is not supported by the deterministic formatter.`,
      details: { citationStyle },
    });
  }

  return {
    journalId: input.journalId,
    journalName: input.journalName,
    safeAutoActions,
    manualActions,
    unsupportedChecks,
    summary: {
      titleWordCount,
      abstractWordCount,
      totalWordCount,
      mainTextWordCount,
      figureCount,
      tableCount,
      citationStyleSupported: Boolean(citationStyle && SUPPORTED_CITATION_STYLES.has(citationStyle)),
    },
  };
}
