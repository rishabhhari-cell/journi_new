import type {
  PublisherBucket,
  StudyDesignBucket,
} from "./parser-benchmark.types";

export const PARSER_BENCHMARK_ROOT = "data/parser-benchmark";
export const MANIFEST_PATH = `${PARSER_BENCHMARK_ROOT}/manifest.jsonl`;
export const REPORTS_DIR = `${PARSER_BENCHMARK_ROOT}/reports`;
export const RESULTS_DIR = `${PARSER_BENCHMARK_ROOT}/results`;
export const TRUTH_DIR = `${PARSER_BENCHMARK_ROOT}/truth`;
export const XML_DIR = `${PARSER_BENCHMARK_ROOT}/xml`;
export const PDF_DIR = `${PARSER_BENCHMARK_ROOT}/pdf`;
export const DOCX_DIR = `${PARSER_BENCHMARK_ROOT}/docx`;
export const REVIEW_PACK_DIR = `${PARSER_BENCHMARK_ROOT}/review-pack`;

export const PUBLISHER_BUCKETS: PublisherBucket[] = [
  "springer_nature",
  "wiley",
  "taylor_francis",
  "sage",
  "elsevier",
];

export const STUDY_DESIGN_BUCKETS: StudyDesignBucket[] = [
  "systematic_review_meta_analysis",
  "review_non_systematic",
  "rct_or_interventional_trial",
  "observational_cohort_case_control_cross_sectional",
  "case_report_or_case_series",
  "other_primary_research",
];

export const PUBLISHER_PATTERNS: Record<PublisherBucket, RegExp[]> = {
  springer_nature: [
    /\bspringer\b/i,
    /\bspringer nature\b/i,
    /\bnature portfolio\b/i,
    /\bbio?med central\b/i,
    /\bbmc\b/i,
  ],
  wiley: [
    /\bwiley\b/i,
    /\bjohn wiley\b/i,
    /\bwiley-blackwell\b/i,
    /\bblackwell\b/i,
    /\bhindawi\b/i,
  ],
  taylor_francis: [
    /\btaylor\s*&\s*francis\b/i,
    /\btaylor and francis\b/i,
    /\binforma\b/i,
    /\broutledge\b/i,
  ],
  sage: [
    /\bsage\b/i,
    /\bsage publications\b/i,
  ],
  elsevier: [
    /\belsevier\b/i,
    /\bcell press\b/i,
    /\bacademic press\b/i,
    /\bexerpta medica\b/i,
  ],
};

export const STUDY_BUCKET_TARGETS: Record<StudyDesignBucket, number> = {
  systematic_review_meta_analysis: 150,
  review_non_systematic: 150,
  rct_or_interventional_trial: 250,
  observational_cohort_case_control_cross_sectional: 300,
  case_report_or_case_series: 100,
  other_primary_research: 50,
};

export const DISCOVERY_OVERSAMPLE_MULTIPLIER = 1.4;
export const REQUIRED_JOURNALS_PER_PUBLISHER = 10;
export const MAX_ARTICLES_PER_JOURNAL = 150;
export const DEFAULT_DISCOVERY_BATCH_SIZE = 200;
export const DEFAULT_DOWNLOAD_CONCURRENCY = 8;
export const DEFAULT_PARSE_CONCURRENCY = 4;
export const DEFAULT_LLM_CONCURRENCY = 2;

export const PUBMED_STUDY_QUERY_BY_BUCKET: Record<StudyDesignBucket, string> = {
  systematic_review_meta_analysis:
    '("systematic review"[pt] OR "meta-analysis"[pt] OR systematic[sb])',
  review_non_systematic:
    '("review"[pt] NOT ("systematic review"[pt] OR "meta-analysis"[pt]))',
  rct_or_interventional_trial:
    '("randomized controlled trial"[pt] OR "clinical trial"[pt] OR "adaptive clinical trial"[pt])',
  observational_cohort_case_control_cross_sectional:
    '("cohort studies"[mh] OR "case-control studies"[mh] OR "cross-sectional studies"[mh])',
  case_report_or_case_series:
    '("case reports"[pt] OR "case report"[ti])',
  other_primary_research:
    '("journal article"[pt] NOT ("review"[pt] OR "systematic review"[pt] OR "meta-analysis"[pt] OR "clinical trial"[pt] OR "randomized controlled trial"[pt] OR "case reports"[pt]))',
};

export const REQUIRED_SECTION_KEYS_BY_STUDY_BUCKET: Record<StudyDesignBucket, string[]> = {
  systematic_review_meta_analysis: [
    "title",
    "abstract",
    "introduction",
    "methods",
    "results",
    "discussion",
    "conclusions",
  ],
  review_non_systematic: [
    "title",
    "abstract",
    "introduction",
    "discussion",
    "conclusions",
  ],
  rct_or_interventional_trial: [
    "title",
    "abstract",
    "introduction",
    "methods",
    "results",
    "discussion",
  ],
  observational_cohort_case_control_cross_sectional: [
    "title",
    "abstract",
    "introduction",
    "methods",
    "results",
    "discussion",
  ],
  case_report_or_case_series: [
    "title",
    "abstract",
    "introduction",
    "results",
    "discussion",
  ],
  other_primary_research: [
    "title",
    "abstract",
    "introduction",
    "results",
    "discussion",
  ],
};
