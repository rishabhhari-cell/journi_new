import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import type { Journal, JournalFilters } from '@/types';
import { MEDICAL_JOURNALS } from '@/data/journals-database';

// ============================================================================
// Context Type Definition
// ============================================================================

interface JournalsContextType {
  allJournals: Journal[];
  filteredJournals: Journal[];
  filters: JournalFilters;
  setFilters: (filters: JournalFilters) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  resultsPerPage: number;
  setResultsPerPage: (count: number) => void;
  paginatedJournals: Journal[];
  totalPages: number;
  totalResults: number;
  getJournalById: (id: string) => Journal | undefined;
}

// ============================================================================
// Create Context
// ============================================================================

const JournalsContext = createContext<JournalsContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface JournalsProviderProps {
  children: ReactNode;
}

export function JournalsProvider({ children }: JournalsProviderProps) {
  // Use the static real medical journal database
  const [allJournals] = useState<Journal[]>(() => MEDICAL_JOURNALS);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<JournalFilters>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [resultsPerPage, setResultsPerPage] = useState<number>(25);

  // ========================================
  // Search & Filter Logic
  // ========================================

  const filteredJournals = useMemo(() => {
    let results = [...allJournals];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (journal) =>
          journal.name.toLowerCase().includes(query) ||
          journal.publisher.toLowerCase().includes(query) ||
          journal.subjectAreas.some((area) => area.toLowerCase().includes(query))
      );
    }

    // Apply Impact Factor filter
    if (filters.impactFactorMin !== undefined) {
      results = results.filter((journal) => journal.impactFactor >= filters.impactFactorMin!);
    }
    if (filters.impactFactorMax !== undefined) {
      results = results.filter((journal) => journal.impactFactor <= filters.impactFactorMax!);
    }

    // Apply Open Access filter
    if (filters.openAccess !== undefined) {
      results = results.filter((journal) => journal.openAccess === filters.openAccess);
    }

    // Apply Subject Areas filter
    if (filters.subjectAreas && filters.subjectAreas.length > 0) {
      results = results.filter((journal) =>
        journal.subjectAreas.some((area) => filters.subjectAreas!.includes(area))
      );
    }

    // Apply Geographic Locations filter
    if (filters.geographicLocations && filters.geographicLocations.length > 0) {
      results = results.filter((journal) =>
        filters.geographicLocations!.includes(journal.geographicLocation)
      );
    }

    // Apply Time to Publication filter
    if (filters.timeToPublicationMin !== undefined) {
      results = results.filter((journal) => journal.avgDecisionDays >= filters.timeToPublicationMin!);
    }
    if (filters.timeToPublicationMax !== undefined) {
      results = results.filter((journal) => journal.avgDecisionDays <= filters.timeToPublicationMax!);
    }

    return results;
  }, [allJournals, searchQuery, filters]);

  // ========================================
  // Pagination Logic
  // ========================================

  const totalResults = filteredJournals.length;
  const totalPages = Math.ceil(totalResults / resultsPerPage);

  const paginatedJournals = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    return filteredJournals.slice(startIndex, endIndex);
  }, [filteredJournals, currentPage, resultsPerPage]);

  // Reset to page 1 when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters]);

  // ========================================
  // Lookup
  // ========================================

  const getJournalById = useCallback(
    (id: string) => allJournals.find((j) => j.id === id),
    [allJournals]
  );

  // ========================================
  // Context Value
  // ========================================

  const value: JournalsContextType = {
    allJournals,
    filteredJournals,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    resultsPerPage,
    setResultsPerPage,
    paginatedJournals,
    totalPages,
    totalResults,
    getJournalById,
  };

  return <JournalsContext.Provider value={value}>{children}</JournalsContext.Provider>;
}

// ============================================================================
// Hook to use Journals Context
// ============================================================================

export function useJournals() {
  const context = useContext(JournalsContext);
  if (context === undefined) {
    throw new Error('useJournals must be used within a JournalsProvider');
  }
  return context;
}
