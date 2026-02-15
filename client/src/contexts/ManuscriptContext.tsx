import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { Manuscript, DocumentSection, Citation, Comment, CitationFormData, CommentFormData } from '@/types';
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from '@/lib/storage';
import { generateSampleManuscript } from '@/data/generators';
import { useProject } from './ProjectContext';

// ============================================================================
// Context Type Definition
// ============================================================================

interface ManuscriptContextType {
  manuscript: Manuscript;
  activeSection: string;
  setActiveSection: (sectionTitle: string) => void;
  updateTitle: (title: string) => void;
  updateSectionContent: (sectionId: string, content: string) => void;
  addCitation: (citation: CitationFormData) => void;
  removeCitation: (citationId: string) => void;
  addComment: (comment: CommentFormData) => void;
  removeComment: (commentId: string) => void;
  resolveComment: (commentId: string) => void;
  getSection: (sectionId: string) => DocumentSection | undefined;
  getSectionByTitle: (title: string) => DocumentSection | undefined;
  replaceSections: (sections: DocumentSection[]) => void;
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

  // Load initial data from localStorage or generate sample data
  const [manuscript, setManuscript] = useState<Manuscript>(() => {
    const stored = loadFromStorage<Manuscript | null>(STORAGE_KEYS.MANUSCRIPT, null);
    return stored || generateSampleManuscript(project.id, project.collaborators);
  });

  const [activeSection, setActiveSection] = useState<string>('Methods');

  // Save to localStorage whenever manuscript changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MANUSCRIPT, manuscript);
  }, [manuscript]);

  // ========================================
  // Title Management
  // ========================================

  const updateTitle = useCallback((title: string) => {
    setManuscript((prev) => ({
      ...prev,
      title,
      updatedAt: new Date(),
    }));
  }, []);

  // ========================================
  // Section Management Functions
  // ========================================

  const updateSectionContent = useCallback((sectionId: string, content: string) => {
    setManuscript((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
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
  }, [project.collaborators]);

  const getSection = (sectionId: string): DocumentSection | undefined => {
    return manuscript.sections.find((section) => section.id === sectionId);
  };

  const getSectionByTitle = (title: string): DocumentSection | undefined => {
    return manuscript.sections.find((section) => section.title === title);
  };

  const replaceSections = useCallback((newSections: DocumentSection[]) => {
    setManuscript((prev) => ({
      ...prev,
      sections: newSections,
      updatedAt: new Date(),
    }));
  }, []);

  // ========================================
  // Citation Management Functions
  // ========================================

  const addCitation = (citationData: CitationFormData) => {
    const newCitation: Citation = {
      id: nanoid(),
      ...citationData,
    };

    setManuscript((prev) => ({
      ...prev,
      citations: [...prev.citations, newCitation],
      updatedAt: new Date(),
    }));
  };

  const removeCitation = (citationId: string) => {
    setManuscript((prev) => ({
      ...prev,
      citations: prev.citations.filter((c) => c.id !== citationId),
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
    };

    setManuscript((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
      updatedAt: new Date(),
    }));
  };

  const removeComment = (commentId: string) => {
    setManuscript((prev) => ({
      ...prev,
      comments: prev.comments.filter((c) => c.id !== commentId),
      updatedAt: new Date(),
    }));
  };

  const resolveComment = (commentId: string) => {
    setManuscript((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === commentId ? { ...c, resolved: true } : c
      ),
      updatedAt: new Date(),
    }));
  };

  // ========================================
  // Context Value
  // ========================================

  const value: ManuscriptContextType = {
    manuscript,
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
