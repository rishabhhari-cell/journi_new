export type PublisherBucket =
  | "springer_nature"
  | "wiley"
  | "taylor_francis"
  | "sage"
  | "elsevier";

export type StudyDesignBucket =
  | "systematic_review_meta_analysis"
  | "review_non_systematic"
  | "rct_or_interventional_trial"
  | "observational_cohort_case_control_cross_sectional"
  | "case_report_or_case_series"
  | "other_primary_research";

export type StudyDesignConfidence = "high" | "medium" | "low";

export type ParserBenchmarkRunMode = "parser_only" | "parser_plus_llm";

export type BenchmarkArtifactStatus =
  | "pending"
  | "ready"
  | "failed"
  | "missing"
  | "skipped";

export interface StudyDesignNormalizationResult {
  bucket: StudyDesignBucket;
  confidence: StudyDesignConfidence;
  reasons: string[];
}

export interface PublisherMatchResult {
  bucket: PublisherBucket | null;
  confidence: "high" | "medium" | "low";
  matchedPattern?: string;
}

export interface CorpusArtifactRecord {
  status: BenchmarkArtifactStatus;
  path?: string;
  sha256?: string;
  sourceUrl?: string;
  bytes?: number;
  error?: string;
}

export interface CorpusDiscoveryRecord {
  pmid: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  abstractText?: string;
  journal?: string;
  publisherRaw?: string;
  publisherBucket?: PublisherBucket;
  publisherConfidence?: "high" | "medium" | "low";
  publicationYear?: number;
  publicationTypesRaw: string[];
  studyDesignBucket: StudyDesignBucket;
  studyDesignConfidence: StudyDesignConfidence;
  isRetracted: boolean;
  licenseCode?: string | null;
  xmlUrl?: string;
  pdfUrl?: string;
  sourceQuery?: string;
  notes?: string[];
}

export interface CorpusManifestRow extends CorpusDiscoveryRecord {
  selected: boolean;
  xml: CorpusArtifactRecord;
  pdf: CorpusArtifactRecord;
  docx: CorpusArtifactRecord;
  truth: CorpusArtifactRecord;
  parserOnlyPdf?: ParserBenchmarkResultRecord;
  parserOnlyDocx?: ParserBenchmarkResultRecord;
  parserPlusLlmPdf?: ParserBenchmarkResultRecord;
  parserPlusLlmDocx?: ParserBenchmarkResultRecord;
}

export interface GroundTruthSection {
  sourceTitle: string;
  canonicalTitle: string;
  order: number;
  text: string;
  wordCount: number;
}

export interface GroundTruthReference {
  rawText: string;
  title?: string;
  year?: number;
  doi?: string;
}

export interface GroundTruthFigure {
  label?: string;
  caption?: string;
}

export interface GroundTruthTable {
  label?: string;
  caption?: string;
}

export interface JatsGroundTruth {
  pmid?: string;
  pmcid?: string;
  doi?: string;
  journal?: string;
  publisherName?: string;
  title: string;
  abstractText: string;
  authors: string[];
  institutions: string[];
  sections: GroundTruthSection[];
  references: GroundTruthReference[];
  figures: GroundTruthFigure[];
  tables: GroundTruthTable[];
  publicationTypesRaw: string[];
  studyDesignBucket?: StudyDesignBucket;
}

export interface SectionComparison {
  canonicalTitle: string;
  truthWordCount: number;
  parsedWordCount: number;
  tokenPrecision: number;
  tokenRecall: number;
  lcsRatio: number;
  matched: boolean;
}

export interface ScoreBreakdown {
  metadata: number;
  structure: number;
  content: number;
  references: number;
  figuresTables: number;
  overall: number;
}

export interface BenchmarkDocumentMetrics {
  titleExactMatch: boolean;
  titleTokenF1: number;
  authorRecall: number;
  institutionRecall: number;
  headingPrecision: number;
  headingRecall: number;
  sectionOrderAgreement: number;
  bodyCoverageRecall: number;
  bodyCoveragePrecision: number;
  referenceCountDelta: number;
  referenceDoiRecall: number;
  figureCountDelta: number;
  tableCountDelta: number;
  sectionComparisons: SectionComparison[];
}

export interface ParserBenchmarkResultRecord {
  mode: ParserBenchmarkRunMode;
  format: "pdf" | "docx";
  parseConfidence?: number;
  reviewRequired?: boolean;
  llmFallbackTriggered: boolean;
  diagnosticCodes: string[];
  hardFailureReasons: string[];
  metrics: BenchmarkDocumentMetrics;
  scores: ScoreBreakdown;
  rawResultPath?: string;
  createdAt: string;
}

export interface BenchmarkSummaryRow {
  publisherBucket?: PublisherBucket;
  studyDesignBucket?: StudyDesignBucket;
  format: "pdf" | "docx";
  mode: ParserBenchmarkRunMode;
  documentCount: number;
  llmFallbackCount: number;
  avgOverallScore: number;
  avgMetadataScore: number;
  avgStructureScore: number;
  avgContentScore: number;
  avgReferenceScore: number;
  avgFiguresTablesScore: number;
}
