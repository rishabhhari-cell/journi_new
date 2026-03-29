import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";

export interface ReformatSuggestion {
  sectionId: string;
  sectionTitle: string;
  type: "word_trim" | "section_add" | "citation_style" | "heading_rename" | "structure";
  /** The exact span of text to be replaced (must exist verbatim in section content) */
  originalText: string;
  /** Proposed replacement — shorter, rephrased, or reformatted */
  suggestedText: string;
  /** One-sentence reason shown to the user */
  reason: string;
}

export interface ReformatInput {
  manuscriptSections: Array<{
    id: string;
    title: string;
    contentHtml: string;
    wordCount?: number;
  }>;
  journalGuidelines: {
    journalName: string;
    wordLimits?: {
      abstract?: number | null;
      main_text?: number | null;
      total?: number | null;
    } | null;
    sectionsRequired?: string[] | null;
    citationStyle?: string | null;
    figuresMax?: number | null;
    tablesMax?: number | null;
    structuredAbstract?: boolean | null;
    notes?: string | null;
    acceptanceRate?: number | null;
    avgDecisionDays?: number | null;
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildPrompt(input: ReformatInput): string {
  const { manuscriptSections, journalGuidelines: g } = input;

  const sectionsSummary = manuscriptSections
    .map((s) => {
      const plain = stripHtml(s.contentHtml);
      const wc = s.wordCount ?? wordCount(plain);
      return `<section id="${s.id}" title="${s.title}" word_count="${wc}">\n${plain.slice(0, 2000)}${plain.length > 2000 ? "\n[...truncated]" : ""}\n</section>`;
    })
    .join("\n\n");

  const guidelines = [
    g.wordLimits?.abstract ? `Abstract word limit: ${g.wordLimits.abstract}` : null,
    g.wordLimits?.main_text ? `Main text word limit: ${g.wordLimits.main_text}` : null,
    g.wordLimits?.total ? `Total word limit: ${g.wordLimits.total}` : null,
    g.sectionsRequired ? `Required sections: ${g.sectionsRequired.join(", ")}` : null,
    g.citationStyle ? `Citation style: ${g.citationStyle}` : null,
    g.structuredAbstract !== null ? `Structured abstract required: ${g.structuredAbstract}` : null,
    g.figuresMax != null ? `Maximum figures: ${g.figuresMax}` : null,
    g.tablesMax != null ? `Maximum tables: ${g.tablesMax}` : null,
    g.notes ? `Additional notes: ${g.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a professional medical manuscript editor helping an author prepare their paper for submission to "${g.journalName}".

Journal submission requirements:
${guidelines || "No specific requirements provided."}

Manuscript sections:
${sectionsSummary}

Your task:
- Identify ONLY the minimal changes needed to comply with the journal's word limits, required sections, and formatting rules.
- Do NOT rewrite sentences. Do NOT change the scientific meaning. Do NOT alter data or conclusions.
- Suggest only: trimming overly long sentences, renaming section headings to match required names, or noting missing required sections.
- For each suggestion, the originalText MUST be an EXACT verbatim substring from the section content above (copy it precisely).
- Suggest a maximum of 15 changes total. Prioritise word-limit violations first.

Return your suggestions as XML in EXACTLY this format (no markdown, no preamble):

<suggestions>
  <suggestion>
    <sectionId>SECTION_ID_HERE</sectionId>
    <sectionTitle>SECTION_TITLE_HERE</sectionTitle>
    <type>word_trim|section_add|citation_style|heading_rename|structure</type>
    <originalText>exact verbatim text from the section to be replaced</originalText>
    <suggestedText>the proposed replacement text</suggestedText>
    <reason>One sentence explaining why this change is needed for this journal.</reason>
  </suggestion>
</suggestions>

If no changes are needed, return: <suggestions></suggestions>`;
}

function parseSuggestionsXml(xml: string): ReformatSuggestion[] {
  const suggestions: ReformatSuggestion[] = [];
  const matches = xml.matchAll(/<suggestion>([\s\S]*?)<\/suggestion>/g);

  for (const match of matches) {
    const inner = match[1];
    const get = (tag: string) => {
      const m = inner.match(new RegExp(`<${tag}>(([\\s\\S]*?))<\\/${tag}>`));
      return m ? m[1].trim() : "";
    };

    const sectionId = get("sectionId");
    const sectionTitle = get("sectionTitle");
    const type = get("type") as ReformatSuggestion["type"];
    const originalText = get("originalText");
    const suggestedText = get("suggestedText");
    const reason = get("reason");

    if (!sectionId || !originalText || !suggestedText) continue;

    const validTypes: ReformatSuggestion["type"][] = [
      "word_trim",
      "section_add",
      "citation_style",
      "heading_rename",
      "structure",
    ];

    suggestions.push({
      sectionId,
      sectionTitle,
      type: validTypes.includes(type) ? type : "structure",
      originalText,
      suggestedText,
      reason,
    });
  }

  return suggestions;
}

export async function reformatManuscript(input: ReformatInput): Promise<ReformatSuggestion[]> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured. Add it to your .env file.");
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(input);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return [];
  }

  return parseSuggestionsXml(textBlock.text);
}
