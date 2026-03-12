import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import type { Journal, JournalFilters } from '@/types';
import {
  listJournals,
  searchJournals,
  type JournalSearchResult,
} from '@/lib/journal-search-api';

export type SortBy = 'relevance' | 'impactFactor' | 'acceptanceRate' | 'name';

interface JournalsContextType {
  allJournals: Journal[];
  filteredJournals: Journal[];
  filters: JournalFilters;
  setFilters: (filters: JournalFilters) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  resultsPerPage: number;
  setResultsPerPage: (count: number) => void;
  paginatedJournals: Journal[];
  totalPages: number;
  totalResults: number;
  getJournalById: (id: string) => Journal | undefined;
  dataSource: 'openalex' | 'nlm' | 'static';
  isLoading: boolean;
}

const JournalsContext = createContext<JournalsContextType | undefined>(undefined);

interface JournalsProviderProps {
  children: ReactNode;
}

export function JournalsProvider({ children }: JournalsProviderProps) {
  const [searchResults, setSearchResults] = useState<Journal[]>([]);
  const [searchCache, setSearchCache] = useState<Record<string, Journal>>({});
  const [apiTotalResults, setApiTotalResults] = useState<number>(0);
  const [dataSource, setDataSource] = useState<'openalex' | 'nlm' | 'static'>('openalex');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<JournalFilters>({});
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [resultsPerPage, setResultsPerPage] = useState<number>(25);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const query = searchQuery.trim();
    // For the default (idle) view, fetch a larger batch so the marquee has plenty of journals
    const isIdle = !query;
    const limit = isIdle ? 100 : resultsPerPage;
    const offset = isIdle ? 0 : (currentPage - 1) * resultsPerPage;

    const request: Promise<JournalSearchResult> = query
      ? searchJournals(query, limit, {
          offset,
          isOpenAccess: filters.openAccess,
          subjectAreas: filters.subjectAreas,
        })
      : listJournals(limit, {
          offset,
          isOpenAccess: filters.openAccess,
          subjectAreas: filters.subjectAreas,
        });

    request
      .then((result) => {
        if (isCancelled) return;

        setDataSource(result.source);
        setSearchResults(result.journals);
        setApiTotalResults(result.total);
        setIsLoading(false);

        setSearchCache((previous) => {
          const next = { ...previous };
          for (const journal of result.journals) {
            next[journal.id] = journal;
          }
          return next;
        });
      })
      .catch(() => {
        if (!isCancelled) {
          setDataSource('static');
          setSearchResults([]);
          setApiTotalResults(0);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [searchQuery, filters.openAccess, filters.subjectAreas, currentPage, resultsPerPage]);

  const allJournals = useMemo(() => {
    const deduped = new Map<string, Journal>();
    for (const journal of Object.values(searchCache)) {
      deduped.set(journal.id, journal);
    }
    return Array.from(deduped.values());
  }, [searchCache]);

  const filteredJournals = useMemo(() => {
    let results = [...searchResults];

    // Apply client-side-only filters (impact factor, geographic, decision time)
    if (filters.impactFactorMin !== undefined) {
      results = results.filter(
        (journal) =>
          typeof journal.impactFactor === 'number' && journal.impactFactor >= filters.impactFactorMin!,
      );
    }
    if (filters.impactFactorMax !== undefined) {
      results = results.filter(
        (journal) =>
          typeof journal.impactFactor === 'number' && journal.impactFactor <= filters.impactFactorMax!,
      );
    }
    if (filters.geographicLocations && filters.geographicLocations.length > 0) {
      results = results.filter((journal) => filters.geographicLocations?.includes(journal.geographicLocation));
    }
    if (filters.timeToPublicationMin !== undefined) {
      results = results.filter(
        (journal) =>
          typeof journal.avgDecisionDays === 'number' &&
          journal.avgDecisionDays >= filters.timeToPublicationMin!,
      );
    }
    if (filters.timeToPublicationMax !== undefined) {
      results = results.filter(
        (journal) =>
          typeof journal.avgDecisionDays === 'number' &&
          journal.avgDecisionDays <= filters.timeToPublicationMax!,
      );
    }

    switch (sortBy) {
      case 'impactFactor':
        results.sort((a, b) => (b.impactFactor ?? -1) - (a.impactFactor ?? -1));
        break;
      case 'acceptanceRate':
        results.sort((a, b) => (b.acceptanceRate ?? -1) - (a.acceptanceRate ?? -1));
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'relevance':
      default:
        break;
    }

    return results;
  }, [searchResults, filters, sortBy]);

  const totalResults = apiTotalResults;
  const totalPages = Math.ceil(totalResults / resultsPerPage);

  const paginatedJournals = filteredJournals;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sortBy]);

  const getJournalById = useCallback(
    (id: string) => allJournals.find((journal) => journal.id === id),
    [allJournals],
  );

  const value: JournalsContextType = {
    allJournals,
    filteredJournals,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    resultsPerPage,
    setResultsPerPage,
    paginatedJournals,
    totalPages,
    totalResults,
    getJournalById,
    dataSource,
    isLoading,
  };

  return <JournalsContext.Provider value={value}>{children}</JournalsContext.Provider>;
}

export function useJournals() {
  const context = useContext(JournalsContext);
  if (context === undefined) {
    throw new Error('useJournals must be used within a JournalsProvider');
  }
  return context;
}
