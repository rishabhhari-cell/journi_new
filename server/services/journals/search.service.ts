import type { PaginatedResult } from "../../../shared/backend";
import { env } from "../../config/env";
import { InMemoryCache } from "../../lib/cache";
import { supabaseAdmin } from "../../lib/supabase";
import { mapJournalRow, type JournalRow } from "./types";

export interface JournalSearchFilters {
  q?: string;
  page: number;
  perPage: number;
  sortBy: "relevance" | "impact_factor" | "name" | "last_verified_at";
  sortDirection: "asc" | "desc";
  openAccess?: boolean;
  impactFactorMin?: number;
  impactFactorMax?: number;
  subjectAreas?: string[];
}

const cache = new InMemoryCache<PaginatedResult<ReturnType<typeof mapJournalRow>>>(
  env.JOURNAL_CACHE_TTL_SECONDS,
);

function safeSearchTerm(value: string): string {
  return value.replace(/[%_]/g, "").trim();
}

function buildCacheKey(filters: JournalSearchFilters): string {
  return JSON.stringify(filters);
}

export async function searchJournals(filters: JournalSearchFilters) {
  const key = buildCacheKey(filters);
  const cached = cache.get(key);
  if (cached) return cached;

  let query = supabaseAdmin.from("journals").select("*", { count: "exact" });

  if (filters.q?.trim()) {
    const q = safeSearchTerm(filters.q);
    query = query.or(`name.ilike.%${q}%,publisher.ilike.%${q}%,abbreviation.ilike.%${q}%`);
  }

  if (typeof filters.openAccess === "boolean") {
    query = query.eq("open_access", filters.openAccess);
  }

  if (typeof filters.impactFactorMin === "number") {
    query = query.gte("impact_factor", filters.impactFactorMin);
  }

  if (typeof filters.impactFactorMax === "number") {
    query = query.lte("impact_factor", filters.impactFactorMax);
  }

  if (filters.subjectAreas && filters.subjectAreas.length > 0) {
    query = query.overlaps("subject_areas", filters.subjectAreas);
  }

  const from = (filters.page - 1) * filters.perPage;
  const to = from + filters.perPage - 1;
  const orderColumn = filters.sortBy === "relevance" ? "updated_at" : filters.sortBy;

  const { data, error, count } = await query
    .order(orderColumn, { ascending: filters.sortDirection === "asc", nullsFirst: false })
    .range(from, to);

  if (error) {
    throw new Error(`Journal search failed: ${error.message}`);
  }

  const result = {
    page: filters.page,
    perPage: filters.perPage,
    total: count ?? 0,
    data: ((data ?? []) as JournalRow[]).map(mapJournalRow),
  };

  cache.set(key, result);
  return result;
}

export async function getJournalById(journalId: string) {
  const { data, error } = await supabaseAdmin
    .from("journals")
    .select("*")
    .eq("id", journalId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get journal: ${error.message}`);
  }
  if (!data) return null;
  return mapJournalRow(data as JournalRow);
}

export function invalidateJournalCache() {
  cache.clear();
}
