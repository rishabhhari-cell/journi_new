import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { nanoid } from 'nanoid';
import type {
  Manuscript,
  ManuscriptType,
  DocumentSection,
  Citation,
  Comment,
  CitationFormData,
  CommentFormData,
} from '@/types';
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from '@/lib/storage';
import { generateSampleManuscript } from '@/data/generators';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import {
  fetchManuscripts,
  createManuscript as createManuscriptApi,
  patchManuscript,
  deleteManuscript as deleteManuscriptApi,
  patchManuscriptSection,
  fetchComments,
  createComment as createCommentApi,
  patchComment as patchCommentApi,
  deleteComment as deleteCommentApi,
  createCollaborationSocket,
  type ApiManuscript,
  type ApiComment as BackendComment,
} from '@/lib/api/backend';
import { getStoredSession } from '@/lib/api/client';
import * as Y from 'yjs';

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

const h2 = (text: string) => `<h2>${text}</h2><p></p>`;
const h3 = (text: string) => `<h3>${text}</h3><p></p>`;

const SECTION_TEMPLATES: Partial<Record<ManuscriptType, Partial<Record<string, string>>>> = {
  full_paper: {
    'Abstract': [h3('Background'), h3('Methods'), h3('Results'), h3('Conclusions')].join(''),
    'Materials and Methods': [h3('Study Design'), h3('Participants'), h3('Data Collection'), h3('Statistical Analysis')].join(''),
    'Results': [h3('Participant Characteristics'), h3('Primary Outcomes'), h3('Secondary Outcomes')].join(''),
    'Discussion': [h3('Summary of Findings'), h3('Comparison with Existing Literature'), h3('Strengths & Limitations'), h3('Implications')].join(''),
  },
  abstract: {
    'Abstract': [h3('Background'), h3('Objectives'), h3('Methods'), h3('Results'), h3('Conclusions')].join(''),
  },
  literature_review: {
    'Abstract': [h3('Background'), h3('Objectives'), h3('Data Sources'), h3('Study Selection'), h3('Data Extraction'), h3('Results'), h3('Conclusions')].join(''),
    'Search Strategy': [h3('Search Terms & Keywords'), h3('Database Search Strings'), h3('Date Range'), h3('Language Restrictions')].join(''),
    'Inclusion & Exclusion Criteria': [h3('Inclusion Criteria'), h3('Exclusion Criteria')].join(''),
    'Results & Synthesis': [h3('Study Selection'), h3('Study Characteristics'), h3('Quality Assessment'), h3('Synthesis of Results')].join(''),
    'Discussion': [h3('Summary of Evidence'), h3('Comparison with Existing Literature'), h3('Limitations'), h3('Implications for Practice & Research')].join(''),
  },
  grant_application: {
    'Specific Aims': [h3('Background'), h3('Specific Aim 1'), h3('Specific Aim 2'), h3('Innovation & Impact')].join(''),
    'Background & Significance': [h3('Current State of Knowledge'), h3('Gap in Knowledge'), h3('Significance of Proposed Research')].join(''),
    'Innovation': [h3('Conceptual Innovation'), h3('Methodological Innovation'), h3('Improvement Over Existing Approaches')].join(''),
    'Approach': [h3('Overview'), h3('Aim 1: Approach'), h3('Aim 2: Approach'), h3('Statistical Considerations'), h3('Potential Pitfalls & Alternatives')].join(''),
    'Timeline & Milestones': [h3('Year 1'), h3('Year 2'), h3('Year 3')].join(''),
    'Budget Justification': [h3('Personnel'), h3('Equipment'), h3('Materials & Supplies'), h3('Travel'), h3('Indirect Costs')].join(''),
    'Team & Qualifications': [h3('Principal Investigator'), h3('Co-Investigators'), h3('Collaborators & Consultants')].join(''),
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
  const templates = SECTION_TEMPLATES[type] || {};
  return {
    id: nanoid(),
    projectId,
    title,
    type,
    sections: MANUSCRIPT_SECTIONS[type].map((sectionTitle, index) => ({
      id: nanoid(),
      title: sectionTitle,
      content: templates[sectionTitle] || '<p></p>',
      status: 'pending',
      order: index,
    })),
    comments: [],
    citations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function isManuscriptType(value: string): value is ManuscriptType {
  return Object.prototype.hasOwnProperty.call(MANUSCRIPT_TYPE_LABELS, value);
}

function mapBackendComment(comment: BackendComment): Comment {
  const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
  return {
    id: comment.id,
    userId: comment.author_user_id,
    userName: profile?.full_name ?? 'Unknown User',
    userInitials: profile?.initials ?? 'UN',
    content: comment.content,
    timestamp: new Date(comment.created_at),
    sectionId: comment.section_id ?? undefined,
    parentId: comment.parent_id ?? undefined,
    resolved: comment.resolved ?? false,
    quotedText: comment.quoted_text ?? undefined,
  };
}

function mapBackendManuscript(apiManuscript: ApiManuscript, projectId: string): Manuscript {
  const type = isManuscriptType(apiManuscript.type) ? apiManuscript.type : 'full_paper';
  const sections = (apiManuscript.manuscript_sections ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content_html || '<p></p>',
      status: section.status,
      order: section.sort_order,
      lastEditedBy: section.last_edited_by ?? undefined,
      lastEditedAt: section.last_edited_at ? new Date(section.last_edited_at) : undefined,
    }));

  return {
    id: apiManuscript.id,
    projectId: apiManuscript.project_id || projectId,
    title: apiManuscript.title,
    type,
    sections,
    comments: [],
    citations: [],
    createdAt: new Date(apiManuscript.created_at),
    updatedAt: new Date(apiManuscript.updated_at),
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToUint8(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

interface ManuscriptContextType {
  manuscripts: Manuscript[];
  activeManuscriptId: string;
  manuscript: Manuscript;
  setActiveManuscriptId: (id: string) => void;
  createManuscript: (title: string, type: ManuscriptType) => string;
  deleteManuscript: (id: string) => void;
  manuscriptTypeLabels: Record<ManuscriptType, string>;
  activeSection: string;
  setActiveSection: (sectionTitle: string) => void;
  updateTitle: (title: string) => void;
  updateSectionContent: (sectionId: string, content: string) => void;
  getSection: (sectionId: string) => DocumentSection | undefined;
  getSectionByTitle: (title: string) => DocumentSection | undefined;
  replaceSections: (sections: DocumentSection[]) => void;
  addCitation: (citation: CitationFormData) => void;
  removeCitation: (citationId: string) => void;
  addComment: (comment: CommentFormData) => void;
  removeComment: (commentId: string) => void;
  resolveComment: (commentId: string) => void;
}

const ManuscriptContext = createContext<ManuscriptContextType | undefined>(undefined);

interface ManuscriptProviderProps {
  children: ReactNode;
}

export function ManuscriptProvider({ children }: ManuscriptProviderProps) {
  const { user, isTrial } = useAuth();
  const { activeProject } = useProject();
  const backendMode = Boolean(user && !isTrial && activeProject?.id);
  const sectionSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);
  const syncingFromRealtimeRef = useRef(false);

  const [manuscripts, setManuscripts] = useState<Manuscript[]>(() => {
    const stored = loadFromStorage<Manuscript[] | null>('manuscripts', null);
    if (stored && stored.length > 0) return stored;
    const oldManuscript = loadFromStorage<Manuscript | null>(STORAGE_KEYS.MANUSCRIPT, null);
    if (oldManuscript) {
      return [{ ...oldManuscript, type: oldManuscript.type || 'full_paper' }];
    }
    const sample = generateSampleManuscript('mvp-project', []);
    return [{ ...sample, type: 'full_paper' as ManuscriptType }];
  });

  const [activeManuscriptId, setActiveManuscriptId] = useState<string>(() => manuscripts[0]?.id || '');
  const [activeSection, setActiveSection] = useState<string>('Methods');

  const fallbackManuscript = useMemo(
    () => createEmptyManuscript(activeProject?.id ?? 'mvp-project', 'Untitled Manuscript', 'full_paper'),
    [activeProject?.id],
  );

  const manuscript =
    manuscripts.find((doc) => doc.id === activeManuscriptId) ||
    manuscripts[0] ||
    fallbackManuscript;

  const syncSectionsFromYDoc = useCallback((manuscriptId: string) => {
    const yDoc = yDocRef.current;
    if (!yDoc) return;
    const sectionsMap = yDoc.getMap<Y.Text>('sections');
    if (sectionsMap.size === 0) return;

    syncingFromRealtimeRef.current = true;
    setManuscripts((prev) =>
      prev.map((doc) => {
        if (doc.id !== manuscriptId) return doc;
        return {
          ...doc,
          sections: doc.sections.map((section) => {
            const yText = sectionsMap.get(section.id);
            if (!yText) return section;
            return {
              ...section,
              content: yText.toString(),
              lastEditedAt: new Date(),
            };
          }),
          updatedAt: new Date(),
        };
      }),
    );
    syncingFromRealtimeRef.current = false;
  }, []);

  const upsertRealtimeSection = useCallback((sectionId: string, content: string) => {
    const yDoc = yDocRef.current;
    if (!yDoc) return;
    const sectionsMap = yDoc.getMap<Y.Text>('sections');
    yDoc.transact(() => {
      let yText = sectionsMap.get(sectionId);
      if (!yText) {
        yText = new Y.Text();
        sectionsMap.set(sectionId, yText);
      }
      yText.delete(0, yText.length);
      yText.insert(0, content);
    }, 'local');
  }, []);

  useEffect(() => {
    saveToStorage('manuscripts', manuscripts);
    if (manuscript) {
      saveToStorage(STORAGE_KEYS.MANUSCRIPT, manuscript);
    }
  }, [manuscripts, manuscript]);

  useEffect(() => {
    let cancelled = false;
    if (!backendMode || !activeProject?.id) return;

    (async () => {
      try {
        const response = await fetchManuscripts(activeProject.id);
        if (cancelled) return;
        let mapped = response.data.map((doc) => mapBackendManuscript(doc, activeProject.id));

        if (mapped.length === 0) {
          const created = await createManuscriptApi({
            projectId: activeProject.id,
            title: 'Untitled Manuscript',
            type: 'full_paper',
            sections: MANUSCRIPT_SECTIONS.full_paper.map((title) => ({
              title,
              contentHtml: '<p></p>',
              status: 'pending',
            })),
          });
          mapped = [mapBackendManuscript(created.data, activeProject.id)];
        }

        setManuscripts((prev) => {
          const previousById = new Map(prev.map((doc) => [doc.id, doc]));
          return mapped.map((doc) => ({
            ...doc,
            comments: previousById.get(doc.id)?.comments ?? [],
            citations: previousById.get(doc.id)?.citations ?? [],
          }));
        });

        setActiveManuscriptId((prevId) => {
          if (mapped.some((doc) => doc.id === prevId)) return prevId;
          return mapped[0]?.id ?? '';
        });
      } catch {
        // Keep local fallback if backend fetch fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backendMode, activeProject?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!backendMode || !manuscript?.id) return;

    (async () => {
      try {
        const response = await fetchComments(manuscript.id);
        if (cancelled) return;
        const comments = response.data.map(mapBackendComment);
        setManuscripts((prev) =>
          prev.map((doc) =>
            doc.id === manuscript.id
              ? { ...doc, comments }
              : doc,
          ),
        );
      } catch {
        // Keep local comments if backend fetch fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backendMode, manuscript?.id]);

  useEffect(() => {
    if (!backendMode || !manuscript?.id) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      yDocRef.current = null;
      return;
    }

    const session = getStoredSession();
    if (!session?.accessToken) return;

    const ws = createCollaborationSocket(session.accessToken);
    const yDoc = new Y.Doc();
    socketRef.current = ws;
    yDocRef.current = yDoc;

    const seedFromCurrentSections = () => {
      const sectionsMap = yDoc.getMap<Y.Text>('sections');
      if (sectionsMap.size > 0) return;
      yDoc.transact(() => {
        for (const section of manuscript.sections) {
          const yText = new Y.Text();
          yText.insert(0, section.content);
          sectionsMap.set(section.id, yText);
        }
      }, 'seed');
    };

    const handleYUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return;
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'doc_update',
          manuscriptId: manuscript.id,
          update: uint8ToBase64(update),
        }),
      );
    };

    yDoc.on('update', handleYUpdate);
    seedFromCurrentSections();

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join',
          manuscriptId: manuscript.id,
        }),
      );
      ws.send(
        JSON.stringify({
          type: 'presence',
          manuscriptId: manuscript.id,
          state: {
            sectionId: activeSection,
          },
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === 'init' && message.manuscriptId === manuscript.id && message.snapshot) {
          Y.applyUpdate(yDoc, base64ToUint8(message.snapshot), 'remote');
          seedFromCurrentSections();
          syncSectionsFromYDoc(manuscript.id);
          return;
        }
        if (message.type === 'doc_update' && message.manuscriptId === manuscript.id && message.update) {
          Y.applyUpdate(yDoc, base64ToUint8(message.update), 'remote');
          syncSectionsFromYDoc(manuscript.id);
        }
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    return () => {
      yDoc.off('update', handleYUpdate);
      ws.close();
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
      if (yDocRef.current === yDoc) {
        yDocRef.current = null;
      }
    };
  }, [backendMode, manuscript?.id, syncSectionsFromYDoc]);

  useEffect(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !manuscript?.id) return;
    ws.send(
      JSON.stringify({
        type: 'presence',
        manuscriptId: manuscript.id,
        state: { sectionId: activeSection },
      }),
    );
  }, [activeSection, manuscript?.id]);

  useEffect(() => {
    if (manuscript?.sections.length > 0) {
      setActiveSection(manuscript.sections[0].title);
    }
  }, [activeManuscriptId, manuscript]);

  const updateManuscript = useCallback((updater: (doc: Manuscript) => Manuscript) => {
    setManuscripts((prev) => prev.map((doc) => (doc.id === activeManuscriptId ? updater(doc) : doc)));
  }, [activeManuscriptId]);

  const createManuscript = useCallback((title: string, type: ManuscriptType): string => {
    const projectId = activeProject?.id ?? 'mvp-project';
    const optimistic = createEmptyManuscript(projectId, title, type);
    setManuscripts((prev) => [...prev, optimistic]);
    setActiveManuscriptId(optimistic.id);

    if (backendMode && activeProject?.id) {
      void (async () => {
        try {
          const created = await createManuscriptApi({
            projectId: activeProject.id,
            title,
            type,
            sections: optimistic.sections.map((section) => ({
              title: section.title,
              contentHtml: section.content,
              status: section.status,
            })),
          });
          const mapped = mapBackendManuscript(created.data, activeProject.id);
          setManuscripts((prev) =>
            prev.map((doc) =>
              doc.id === optimistic.id
                ? { ...mapped, comments: doc.comments, citations: doc.citations }
                : doc,
            ),
          );
          setActiveManuscriptId(mapped.id);
        } catch {
          // Keep optimistic local manuscript.
        }
      })();
    }

    return optimistic.id;
  }, [activeProject?.id, backendMode]);

  const deleteManuscript = useCallback((id: string) => {
    setManuscripts((prev) => {
      const filtered = prev.filter((doc) => doc.id !== id);
      return filtered.length > 0 ? filtered : prev;
    });

    setActiveManuscriptId((prevId) => {
      if (prevId !== id) return prevId;
      const remaining = manuscripts.filter((doc) => doc.id !== id);
      return remaining[0]?.id ?? prevId;
    });

    if (backendMode) {
      void deleteManuscriptApi(id).catch(() => {
        // Keep optimistic deletion.
      });
    }
  }, [manuscripts, backendMode]);

  const updateTitle = useCallback((title: string) => {
    updateManuscript((doc) => ({ ...doc, title, updatedAt: new Date() }));
    if (backendMode && manuscript?.id) {
      void patchManuscript(manuscript.id, { title }).catch(() => {
        // Keep optimistic update.
      });
    }
  }, [updateManuscript, backendMode, manuscript?.id]);

  const updateSectionContent = useCallback((sectionId: string, content: string) => {
    updateManuscript((doc) => ({
      ...doc,
      sections: doc.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              content,
              lastEditedBy: user?.name || 'Unknown',
              lastEditedAt: new Date(),
            }
          : section,
      ),
      updatedAt: new Date(),
    }));

    if (!syncingFromRealtimeRef.current) {
      upsertRealtimeSection(sectionId, content);
    }

    if (backendMode && manuscript?.id) {
      if (sectionSaveTimers.current[sectionId]) {
        clearTimeout(sectionSaveTimers.current[sectionId]);
      }
      sectionSaveTimers.current[sectionId] = setTimeout(() => {
        void patchManuscriptSection(manuscript.id, sectionId, {
          contentHtml: content,
        }).catch(() => {
          // Keep optimistic update.
        });
      }, 450);
    }
  }, [updateManuscript, upsertRealtimeSection, backendMode, manuscript?.id, user?.name]);

  const getSection = (sectionId: string): DocumentSection | undefined =>
    manuscript?.sections.find((section) => section.id === sectionId);

  const getSectionByTitle = (title: string): DocumentSection | undefined =>
    manuscript?.sections.find((section) => section.title === title);

  const replaceSections = useCallback((sections: DocumentSection[]) => {
    updateManuscript((doc) => ({ ...doc, sections, updatedAt: new Date() }));
    if (backendMode && manuscript?.id) {
      void Promise.all(
        sections.map((section, index) =>
          patchManuscriptSection(manuscript.id, section.id, {
            title: section.title,
            contentHtml: section.content,
            status: section.status,
            sortOrder: index,
          }),
        ),
      ).catch(() => {
        // Keep optimistic update.
      });
    }
  }, [updateManuscript, backendMode, manuscript?.id]);

  const addCitation = (citation: CitationFormData) => {
    const next: Citation = { id: nanoid(), ...citation };
    updateManuscript((doc) => ({
      ...doc,
      citations: [...doc.citations, next],
      updatedAt: new Date(),
    }));
  };

  const removeCitation = (citationId: string) => {
    updateManuscript((doc) => ({
      ...doc,
      citations: doc.citations.filter((citation) => citation.id !== citationId),
      updatedAt: new Date(),
    }));
  };

  const addComment = (commentData: CommentFormData) => {
    const optimistic: Comment = {
      id: nanoid(),
      userId: user?.id ?? 'unknown',
      userName: user?.name ?? 'Unknown User',
      userInitials: user?.initials ?? 'UN',
      content: commentData.content,
      timestamp: new Date(),
      sectionId: commentData.sectionId,
      parentId: commentData.parentId,
      resolved: false,
      quotedText: commentData.quotedText,
    };

    updateManuscript((doc) => ({
      ...doc,
      comments: [...doc.comments, optimistic],
      updatedAt: new Date(),
    }));

    if (backendMode && manuscript?.id) {
      void createCommentApi({
        manuscriptId: manuscript.id,
        sectionId: commentData.sectionId,
        parentId: commentData.parentId,
        content: commentData.content,
        quotedText: commentData.quotedText,
      })
        .then((response) => {
          const mapped = mapBackendComment(response.data);
          setManuscripts((prev) =>
            prev.map((doc) =>
              doc.id === manuscript.id
                ? {
                    ...doc,
                    comments: doc.comments.map((comment) => (comment.id === optimistic.id ? mapped : comment)),
                    updatedAt: new Date(),
                  }
                : doc,
            ),
          );
        })
        .catch(() => {
          // Keep optimistic comment.
        });
    }
  };

  const removeComment = (commentId: string) => {
    updateManuscript((doc) => ({
      ...doc,
      comments: doc.comments.filter((comment) => comment.id !== commentId),
      updatedAt: new Date(),
    }));

    if (backendMode) {
      void deleteCommentApi(commentId).catch(() => {
        // Keep optimistic deletion.
      });
    }
  };

  const resolveComment = (commentId: string) => {
    updateManuscript((doc) => ({
      ...doc,
      comments: doc.comments.map((comment) =>
        comment.id === commentId ? { ...comment, resolved: true } : comment,
      ),
      updatedAt: new Date(),
    }));

    if (backendMode) {
      void patchCommentApi(commentId, { resolved: true }).catch(() => {
        // Keep optimistic state.
      });
    }
  };

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
    getSection,
    getSectionByTitle,
    replaceSections,
    addCitation,
    removeCitation,
    addComment,
    removeComment,
    resolveComment,
  };

  return <ManuscriptContext.Provider value={value}>{children}</ManuscriptContext.Provider>;
}

export function useManuscript() {
  const context = useContext(ManuscriptContext);
  if (context === undefined) {
    throw new Error('useManuscript must be used within a ManuscriptProvider');
  }
  return context;
}
