import type { JournalEnrichment } from "./adapters/types";

export interface GuidelinesExtractionResult extends JournalEnrichment {
  /** Number of fields successfully extracted with high confidence. Used to decide whether to call LLM. */
  confidence: number;
}

// ── Word limit extraction ──────────────────────────────────────────────────

function extractWordLimits(text: string): Record<string, number> | null {
  const limits: Record<string, number> = {};

  const patterns: Array<[string, RegExp]> = [
    ["abstract", /abstract[^.]{0,60}?(\d{1,5})\s*words/i],
    ["main_text", /(?:article|manuscript|paper|text)[^.]{0,80}?(\d{1,5})\s*words/i],
    ["total", /(?:total|overall)[^.]{0,60}?(\d{1,5})\s*words/i],
  ];

  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) limits[key] = Number.parseInt(match[1], 10);
  }

  // Fallback: any "X words" near a limit keyword
  if (!limits.main_text) {
    const general = text.match(/(?:not exceed|limit[^.]{0,30}?)\s*(\d{1,5})\s*words/i);
    if (general) limits.main_text = Number.parseInt(general[1], 10);
  }

  return Object.keys(limits).length > 0 ? limits : null;
}

// ── Citation style extraction ──────────────────────────────────────────────

const CITATION_PATTERNS: Array<[string, RegExp]> = [
  ["vancouver", /vancouver/i],
  ["apa", /\bapa\b/i],
  ["mla", /\bmla\b/i],
  ["harvard", /harvard/i],
  ["ama", /\bama\b/i],
  ["ieee", /\bieee\b/i],
  ["nlm", /\bnlm\b/i],
];

function extractCitationStyle(text: string): string | null {
  for (const [style, pattern] of CITATION_PATTERNS) {
    if (pattern.test(text)) return style;
  }
  return null;
}

// ── Required sections extraction ───────────────────────────────────────────

const KNOWN_SECTIONS = [
  "Introduction",
  "Background",
  "Methods",
  "Materials and Methods",
  "Results",
  "Discussion",
  "Conclusion",
  "Conclusions",
  "Abstract",
  "References",
  "Acknowledgements",
  "Funding",
  "Data Availability",
  "Ethics Statement",
  "Conflicts of Interest",
];

function extractRequiredSections(text: string): string[] | null {
  const found: string[] = [];
  for (const section of KNOWN_SECTIONS) {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
      found.push(section);
    }
  }
  return found.length >= 3 ? found : null;
}

// ── Acceptance rate ─────────────────────────────────────────────────────────

export function extractAcceptanceRate(text: string): number | null {
  const match = text.match(/acceptance\s+rate[^.]{0,60}?(\d{1,3}(?:\.\d+)?)\s*%/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return value > 0 && value <= 100 ? value / 100 : null;
}

// ── Mean time to publication ────────────────────────────────────────────────

export function extractMeanTimeToPublication(text: string): number | null {
  const weekMatch = text.match(
    /(?:time|decision|review|publication)[^.]{0,60}?(\d{1,3}(?:\.\d+)?)\s*weeks?/i,
  );
  if (weekMatch) return Math.round(Number.parseFloat(weekMatch[1]) * 7);

  const dayMatch = text.match(
    /(?:time|decision|review|publication)[^.]{0,60}?(\d{1,3})\s*days?/i,
  );
  if (dayMatch) return Number.parseInt(dayMatch[1], 10);

  return null;
}

// ── Logo extraction ─────────────────────────────────────────────────────────

export function extractLogoFromHtml(html: string, baseUrl: string): string | null {
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) return ogMatch[1];

  const iconMatch =
    html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);
  if (iconMatch?.[1]) {
    const href = iconMatch[1];
    if (href.startsWith("http")) return href;
    try {
      const base = new URL(baseUrl);
      return new URL(href, base.origin).toString();
    } catch {
      return null;
    }
  }

  return null;
}

// ── Main extraction entry point ─────────────────────────────────────────────

export function extractGuidelinesFromHtml(html: string): GuidelinesExtractionResult {
  // Strip tags to get plain text for regex matching
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const wordLimits = extractWordLimits(text);
  const citationStyle = extractCitationStyle(text);
  const sectionsRequired = extractRequiredSections(text);
  const acceptanceRate = extractAcceptanceRate(text);
  const meanTime = extractMeanTimeToPublication(text);

  const fields: Record<string, unknown> = {};
  let confidence = 0;

  if (wordLimits) {
    fields.word_limits = wordLimits;
    confidence += 1;
  }
  if (citationStyle) {
    fields.citation_style = citationStyle;
    confidence += 1;
  }
  if (sectionsRequired) {
    fields.sections_required = sectionsRequired;
    confidence += 1;
  }
  if (acceptanceRate !== null) {
    fields.acceptance_rate = acceptanceRate;
    confidence += 1;
  }
  if (meanTime !== null) {
    fields.mean_time_to_publication_days = meanTime;
    confidence += 1;
  }

  return { source: "scraper", fields, confidence };
}
