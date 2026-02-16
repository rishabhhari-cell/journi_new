import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import type { Journal, JournalFilters } from '@/types';
import { MEDICAL_JOURNALS } from '@/data/journals-database';
import { expandSearchQuery, MEDICAL_SYNONYMS } from '@/lib/medical-synonyms';

// ============================================================================
// Context Type Definition
// ============================================================================

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
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [resultsPerPage, setResultsPerPage] = useState<number>(25);

  // ========================================
  // Search & Filter Logic (Semantic)
  // ========================================

  const filteredJournals = useMemo(() => {
    let results = [...allJournals];

    // Apply search query with comprehensive semantic scoring
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const expandedTerms = expandSearchQuery(query);
      const queryWords = query.split(/\s+/).filter(Boolean);

      // Score each journal for relevance and filter out non-matches
      const scored: { journal: typeof results[0]; score: number }[] = [];

      for (const journal of results) {
        let score = 0;
        const nameLower = journal.name.toLowerCase();
        const publisherLower = journal.publisher.toLowerCase();
        const journalAreasLower = journal.subjectAreas.map((a) => a.toLowerCase());

        // 1. Exact name match (highest priority)
        if (nameLower === query) {
          score += 100;
        } else if (nameLower.includes(query)) {
          score += 50;
        }
        // Partial word matches in name
        for (const word of queryWords) {
          if (word.length >= 3 && nameLower.includes(word)) score += 10;
        }

        // 2. Publisher match
        if (publisherLower.includes(query)) {
          score += 30;
        }
        for (const word of queryWords) {
          if (word.length >= 3 && publisherLower.includes(word)) score += 5;
        }

        // 3. Direct subject area match
        for (const area of journalAreasLower) {
          if (area.includes(query) || query.includes(area)) {
            score += 40;
          }
          for (const word of queryWords) {
            if (word.length >= 3 && area.includes(word)) score += 8;
          }
        }

        // 4. Semantic expansion match — synonym dictionary mapped areas
        for (const term of expandedTerms) {
          const termLower = term.toLowerCase();
          for (const area of journalAreasLower) {
            if (area === termLower) {
              score += 25; // Strong semantic match
            } else if (area.includes(termLower) || termLower.includes(area)) {
              score += 15; // Partial semantic match
            }
          }
        }

        // 5. Reverse lookup: check if any journal subject area has synonym terms
        //    that match the query (e.g., journal has "Cardiology", user searches "heart surgery")
        for (const area of journal.subjectAreas) {
          // Find all synonym terms that map to this area
          for (const [term, areas] of Object.entries(MEDICAL_SYNONYMS)) {
            if (areas.includes(area)) {
              // Check if query contains this synonym term
              if (query.includes(term) || term.includes(query)) {
                score += 20;
              }
              for (const word of queryWords) {
                if (word.length >= 3 && term.includes(word)) score += 3;
              }
            }
          }
        }

        // 6. ISSN match
        if (journal.issn && journal.issn.includes(query)) {
          score += 100;
        }

        if (score > 0) {
          scored.push({ journal, score });
        }
      }

      // Sort by score descending and extract journals
      scored.sort((a, b) => b.score - a.score);
      results = scored.map((s) => s.journal);
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

    // Apply sorting (relevance order is already set by search scoring above)
    switch (sortBy) {
      case 'impactFactor':
        results.sort((a, b) => b.impactFactor - a.impactFactor);
        break;
      case 'acceptanceRate':
        results.sort((a, b) => b.acceptanceRate - a.acceptanceRate);
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'relevance':
      default:
        // When searching, results are already sorted by relevance score
        // When not searching, sort by impact factor as a sensible default
        if (!searchQuery.trim()) {
          results.sort((a, b) => b.impactFactor - a.impactFactor);
        }
        break;
    }

    return results;
  }, [allJournals, searchQuery, filters, sortBy]);

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
  }, [searchQuery, filters, sortBy]);

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
