export interface ReformatSuggestion {
  id: string;
  type: "trim" | "stub" | "restructure" | "reorder" | "citation-style";
  sectionId: string;
  /** Empty string for stubs (new content being added) */
  original: string;
  suggested: string;
  /** Human-readable explanation shown to the user */
  reason: string;
  source: "deterministic" | "llm";
  /** Deterministic suggestions are pre-accepted; LLM suggestions require explicit user action */
  autoAccepted: boolean;
}
