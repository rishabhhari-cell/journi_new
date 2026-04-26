import type { CorpusManifestRow } from "./parser-benchmark.types";

export interface ManifestBatchOptions {
  offset: number;
  limit: number | null;
}

export function getManifestBatchOptions(): ManifestBatchOptions {
  const batchIndexRaw = process.env.BENCHMARK_BATCH_INDEX;
  const batchSizeRaw = process.env.BENCHMARK_BATCH_SIZE ?? process.env.BENCHMARK_BATCH_LIMIT;
  const offsetRaw = process.env.BENCHMARK_BATCH_OFFSET;
  const limitRaw = process.env.BENCHMARK_BATCH_LIMIT;

  const batchIndexValue = Number(batchIndexRaw);
  const batchSizeValue = Number(batchSizeRaw);
  const offsetValue = Number(offsetRaw);
  const limitValue = Number(limitRaw);
  const hasExplicitOffset = offsetRaw != null && offsetRaw !== "" && Number.isFinite(offsetValue) && offsetValue >= 0;
  const hasBatchIndex = batchIndexRaw != null && batchIndexRaw !== "" && Number.isFinite(batchIndexValue) && batchIndexValue >= 0;
  const normalizedBatchSize = Number.isFinite(batchSizeValue) && batchSizeValue > 0 ? Math.floor(batchSizeValue) : null;
  const derivedOffset = hasBatchIndex && normalizedBatchSize != null
    ? Math.floor(batchIndexValue) * normalizedBatchSize
    : 0;

  return {
    offset: hasExplicitOffset ? Math.floor(offsetValue) : derivedOffset,
    limit: limitRaw != null && limitRaw !== "" && Number.isFinite(limitValue) && limitValue > 0
      ? Math.floor(limitValue)
      : normalizedBatchSize,
  };
}

export function selectManifestBatch<T extends CorpusManifestRow>(
  rows: T[],
  predicate: (row: T) => boolean,
): { rows: T[]; totalEligible: number; offset: number; limit: number | null } {
  const options = getManifestBatchOptions();
  const eligibleRows = rows.filter(predicate);
  const start = Math.min(options.offset, eligibleRows.length);
  const end = options.limit == null ? undefined : start + options.limit;

  return {
    rows: eligibleRows.slice(start, end),
    totalEligible: eligibleRows.length,
    offset: start,
    limit: options.limit,
  };
}

export function countManifestBatchRows<T extends CorpusManifestRow>(rows: T[], predicate: (row: T) => boolean): number {
  return rows.filter(predicate).length;
}

export function getBatchIndexLabel(offset: number, limit: number | null): string {
  if (limit == null || limit <= 0) return "full";
  return String(Math.floor(offset / limit));
}

export function formatBatchLabel(totalEligible: number, batchSize: number, offset: number, limit: number | null): string {
  if (limit == null && offset === 0) {
    return `all eligible rows (${batchSize}/${totalEligible})`;
  }

  const end = batchSize === 0 ? offset : offset + batchSize - 1;
  const requested = limit == null ? "all remaining" : String(limit);
  return `rows ${offset}-${end} of ${totalEligible} eligible (requested limit=${requested})`;
}
