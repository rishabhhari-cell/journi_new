import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { Manuscript, ManuscriptType, DocumentSection, Citation, Comment, CitationFormData, CommentFormData } from '@/types';
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from '@/lib/storage';
import { generateSampleManuscript } from '@/data/generators';
import { useProject } from './ProjectContext';

// ============================================================================
// Default sections for each manuscript type
// ============================================================================

const MANUSCRIPT_SECTIONS: Record<ManuscriptType, string[]> = {
  full_paper: [
    'Title Page',
    'Abstract',
    'Introduction',
    'Materials and Methods',
    'Results',
    'Discussion',
    'Conclusions',
    'Acknowledgements',
    'References',
    'Figures and Tables',
  ],
  abstract: ['Abstract'],
  cover_letter: ['Cover Letter'],
  response_letter: ['Response to Reviewers'],
  supplementary: ['Supplementary Materials'],
  literature_review: [
    'Abstract',
    'Introduction',
    'Search Strategy',
    'Inclusion & Exclusion Criteria',
    'Results & Synthesis',
    'Discussion',
    'Limitations',
    'Conclusions',
    'References',
  ],
  grant_application: [
    'Specific Aims',
    'Background & Significance',
    'Innovation',
    'Approach',
    'Timeline & Milestones',
    'Budget Justification',
    'Team & Qualifications',
    'References',
    'Appendices',
  ],
  other: ['Content'],
};

// ============================================================================
// Built-in subheading templates for structured sections
// These pre-populate the TipTap editor with a scaffold when a document is created.
// Only sections that meaningfully benefit from sub-structure are templated.
// ============================================================================

const h2 = (text: string) => `<h2>${text}</h2><p></p>`;
const h3 = (text: string) => `<h3>${text}</h3><p></p>`;

const SECTION_TEMPLATES: Partial<Record<ManuscriptType, Partial<Record<string, string>>>> = {
  full_paper: {
    'Abstract': [
      h3('Background'), h3('Methods'), h3('Results'), h3('Conclusions'),
    ].join(''),
    'Materials and Methods': [
      h3('Study Design'), h3('Participants'), h3('Data Collection'), h3('Statistical Analysis'),
    ].join(''),
    'Results': [
      h3('Participant Characteristics'), h3('Primary Outcomes'), h3('Secondary Outcomes'),
    ].join(''),
    'Discussion': [
      h3('Summary of Findings'), h3('Comparison with Existing Literature'),
      h3('Strengths & Limitations'), h3('Implications'),
    ].join(''),
  },
  abstract: {
    'Abstract': [
      h3('Background'), h3('Objectives'), h3('Methods'), h3('Results'), h3('Conclusions'),
    ].join(''),
  },
  literature_review: {
    'Abstract': [
      h3('Background'), h3('Objectives'), h3('Data Sources'),
      h3('Study Selection'), h3('Data Extraction'), h3('Results'), h3('Conclusions'),
    ].join(''),
    'Search Strategy': [
      h3('Search Terms & Keywords'), h3('Database Search Strings'),
      h3('Date Range'), h3('Language Restrictions'),
    ].join(''),
    'Inclusion & Exclusion Criteria': [
      h3('Inclusion Criteria'), h3('Exclusion Criteria'),
    ].join(''),
    'Results & Synthesis': [
      h3('Study Selection'), h3('Study Characteristics'),
      h3('Quality Assessment'), h3('Synthesis of Results'),
    ].join(''),
    'Discussion': [
      h3('Summary of Evidence'), h3('Comparison with Existing Literature'),
      h3('Limitations'), h3('Implications for Practice & Research'),
    ].join(''),
  },
  grant_application: {
    'Specific Aims': [
      h3('Background'), h3('Specific Aim 1'), h3('Specific Aim 2'), h3('Innovation & Impact'),
    ].join(''),
    'Background & Significance': [
      h3('Current State of Knowledge'), h3('Gap in Knowledge'), h3('Significance of Proposed Research'),
    ].join(''),
    'Innovation': [
      h3('Conceptual Innovation'), h3('Methodological Innovation'),
      h3('Improvement Over Existing Approaches'),
    ].join(''),
    'Approach': [
      h3('Overview'), h3('Aim 1: Approach'), h3('Aim 2: Approach'),
      h3('Statistical Considerations'), h3('Potential Pitfalls & Alternatives'),
    ].join(''),
    'Timeline & Milestones': [
      h3('Year 1'), h3('Year 2'), h3('Year 3'),
    ].join(''),
    'Budget Justification': [
      h3('Personnel'), h3('Equipment'), h3('Materials & Supplies'),
      h3('Travel'), h3('Indirect Costs'),
    ].join(''),
    'Team & Qualifications': [
      h3('Principal Investigator'), h3('Co-Investigators'), h3('Collaborators & Consultants'),
    ].join(''),
  },
};

const MANUSCRIPT_TYPE_LABELS: Record<ManuscriptType, string> = {
  full_paper: 'Full Paper',
  abstract: 'Abstract',
  cover_letter: 'Cover Letter',
  response_letter: 'Response to Reviewers',
  supplementary: 'Supplementary Materials',
  literature_review: 'Literature Review',
  grant_application: 'Grant Application',
  other: 'Other Document',
};

function createEmptyManuscript(projectId: string, title: string, type: ManuscriptType): Manuscript {
  const sectionTitles = MANUSCRIPT_SECTIONS[type];
  const templates = SECTION_TEMPLATES[type] || {};
  return {
    id: nanoid(),
    projectId,
    title,
    type,
    sections: sectionTitles.map((t, i) => ({
      id: nanoid(),
      title: t,
      content: templates[t] || '<p></p>',
      status: 'pending' as const,
      order: i,
    })),
    comments: [],
    citations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================================================
// Context Type Definition
// ============================================================================

interface ManuscriptContextType {
  // Multi-document
  manuscripts: Manuscript[];
  activeManuscriptId: string;
  manuscript: Manuscript; // current active manuscript
  setActiveManuscriptId: (id: string) => void;
  createManuscript: (title: string, type: ManuscriptType) => string; // returns id
  deleteManuscript: (id: string) => void;
  manuscriptTypeLabels: Record<ManuscriptType, string>;

  // Active section
  activeSection: string;
  setActiveSection: (sectionTitle: string) => void;

  // Section/content ops
  updateTitle: (title: string) => void;
  updateSectionContent: (sectionId: string, content: string) => void;
  getSection: (sectionId: string) => DocumentSection | undefined;
  getSectionByTitle: (title: string) => DocumentSection | undefined;
  replaceSections: (sections: DocumentSection[]) => void;

  // Citations
  addCitation: (citation: CitationFormData) => void;
  removeCitation: (citationId: string) => void;

  // Comments
  addComment: (comment: CommentFormData) => void;
  removeComment: (commentId: string) => void;
  resolveComment: (commentId: string) => void;
}

// ============================================================================
// Create Context
// ============================================================================

const ManuscriptContext = createContext<ManuscriptContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface ManuscriptProviderProps {
  children: ReactNode;
}

export function ManuscriptProvider({ children }: ManuscriptProviderProps) {
  const { project } = useProject();

  // Load all manuscripts from localStorage
  const [manuscripts, setManuscripts] = useState<Manuscript[]>(() => {
    const stored = loadFromStorage<Manuscript[] | null>('manuscripts', null);
    if (stored && stored.length > 0) return stored;

    // Migrate: check if there's a single old-style manuscript
    const oldManuscript = loadFromStorage<Manuscript | null>(STORAGE_KEYS.MANUSCRIPT, null);
    if (oldManuscript) {
      const migrated = { ...oldManuscript, type: oldManuscript.type || 'full_paper' as ManuscriptType };
      return [migrated];
    }

    // Generate sample
    const sample = generateSampleManuscript(project.id, project.collaborators);
    return [{ ...sample, type: 'full_paper' as ManuscriptType }];
  });

  const [activeManuscriptId, setActiveManuscriptId] = useState<string>(() => {
    return manuscripts[0]?.id || '';
  });

  const [activeSection, setActiveSection] = useState<string>('Methods');

  // Current active manuscript
  const manuscript = manuscripts.find((m) => m.id === activeManuscriptId) || manuscripts[0];

  // Save to localStorage whenever manuscripts change
  useEffect(() => {
    saveToStorage('manuscripts', manuscripts);
    // Also save current manuscript under old key for backward compat
    if (manuscript) {
      saveToStorage(STORAGE_KEYS.MANUSCRIPT, manuscript);
    }
  }, [manuscripts, manuscript]);

  // When active manuscript changes, reset active section
  useEffect(() => {
    if (manuscript && manuscript.sections.length > 0) {
      setActiveSection(manuscript.sections[0].title);
    }
  }, [activeManuscriptId]);

  // ========================================
  // Multi-document management
  // ========================================

  const createManuscript = useCallback((title: string, type: ManuscriptType): string => {
    const newDoc = createEmptyManuscript(project.id, title, type);
    setManuscripts((prev) => [...prev, newDoc]);
    setActiveManuscriptId(newDoc.id);
    return newDoc.id;
  }, [project.id]);

  const deleteManuscript = useCallback((id: string) => {
    setManuscripts((prev) => {
      const filtered = prev.filter((m) => m.id !== id);
      if (filtered.length === 0) {
        // Don't allow deleting the last document
        return prev;
      }
      return filtered;
    });
    // If we deleted the active one, switch to the first remaining
    setActiveManuscriptId((prevId) => {
      if (prevId === id) {
        const remaining = manuscripts.filter((m) => m.id !== id);
        return remaining[0]?.id || '';
      }
      return prevId;
    });
  }, [manuscripts]);

  // ========================================
  // Update helpers — always target the active manuscript
  // ========================================

  const updateManuscript = useCallback((updater: (m: Manuscript) => Manuscript) => {
    setManuscripts((prev) =>
      prev.map((m) => (m.id === activeManuscriptId ? updater(m) : m))
    );
  }, [activeManuscriptId]);

  // ========================================
  // Title Management
  // ========================================

  const updateTitle = useCallback((title: string) => {
    updateManuscript((m) => ({ ...m, title, updatedAt: new Date() }));
  }, [updateManuscript]);

  // ========================================
  // Section Management Functions
  // ========================================

  const updateSectionContent = useCallback((sectionId: string, content: string) => {
    updateManuscript((m) => ({
      ...m,
      sections: m.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              content,
              lastEditedAt: new Date(),
              lastEditedBy: project.collaborators[0]?.name || 'Unknown',
            }
          : section
      ),
      updatedAt: new Date(),
    }));
  }, [updateManuscript, project.collaborators]);

  const getSection = (sectionId: string): DocumentSection | undefined => {
    return manuscript?.sections.find((section) => section.id === sectionId);
  };

  const getSectionByTitle = (title: string): DocumentSection | undefined => {
    return manuscript?.sections.find((section) => section.title === title);
  };

  const replaceSections = useCallback((newSections: DocumentSection[]) => {
    updateManuscript((m) => ({ ...m, sections: newSections, updatedAt: new Date() }));
  }, [updateManuscript]);

  // ========================================
  // Citation Management Functions
  // ========================================

  const addCitation = (citationData: CitationFormData) => {
    const newCitation: Citation = {
      id: nanoid(),
      ...citationData,
    };
    updateManuscript((m) => ({
      ...m,
      citations: [...m.citations, newCitation],
      updatedAt: new Date(),
    }));
  };

  const removeCitation = (citationId: string) => {
    updateManuscript((m) => ({
      ...m,
      citations: m.citations.filter((c) => c.id !== citationId),
      updatedAt: new Date(),
    }));
  };

  // ========================================
  // Comment Management Functions
  // ========================================

  const addComment = (commentData: CommentFormData) => {
    const collaborator = project.collaborators[0]; // Current user
    const newComment: Comment = {
      id: nanoid(),
      userId: collaborator?.id || 'unknown',
      userName: collaborator?.name || 'Unknown User',
      userInitials: collaborator?.initials || 'UN',
      content: commentData.content,
      timestamp: new Date(),
      sectionId: commentData.sectionId,
      parentId: commentData.parentId,
      resolved: false,
      quotedText: commentData.quotedText,
    };

    updateManuscript((m) => ({
      ...m,
      comments: [...m.comments, newComment],
      updatedAt: new Date(),
    }));
  };

  const removeComment = (commentId: string) => {
    updateManuscript((m) => ({
      ...m,
      comments: m.comments.filter((c) => c.id !== commentId),
      updatedAt: new Date(),
    }));
  };

  const resolveComment = (commentId: string) => {
    updateManuscript((m) => ({
      ...m,
      comments: m.comments.map((c) =>
        c.id === commentId ? { ...c, resolved: true } : c
      ),
      updatedAt: new Date(),
    }));
  };

  // ========================================
  // Context Value
  // ========================================

  const value: ManuscriptContextType = {
    manuscripts,
    activeManuscriptId,
    manuscript,
    setActiveManuscriptId,
    createManuscript,
    deleteManuscript,
    manuscriptTypeLabels: MANUSCRIPT_TYPE_LABELS,
    activeSection,
    setActiveSection,
    updateTitle,
    updateSectionContent,
    addCitation,
    removeCitation,
    addComment,
    removeComment,
    resolveComment,
    getSection,
    getSectionByTitle,
    replaceSections,
  };

  return <ManuscriptContext.Provider value={value}>{children}</ManuscriptContext.Provider>;
}

// ============================================================================
// Hook to use Manuscript Context
// ============================================================================

export function useManuscript() {
  const context = useContext(ManuscriptContext);
  if (context === undefined) {
    throw new Error('useManuscript must be used within a ManuscriptProvider');
  }
  return context;
}
