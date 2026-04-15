/**
 * Journi Collaboration Workspace
 * Multi-document TipTap editor with citations, comments, word count, editable title,
 * images, tables, text-selection commenting, import/export, and "Everything" view.
 * Shows onboarding screen when document sections are all empty.
 */
import { useState, useMemo, useRef, useEffect, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle, Circle, BookOpen, MessageSquare, Pencil, Check, FileText,
  FileDown, Loader2, MessageSquarePlus, Layers, Plus, Trash2,
  FilePlus2, FileUp, ChevronDown, DollarSign, AlertTriangle, Minus,
  BookMarked, Database, Send, X, Wand2,
} from 'lucide-react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { EditorContent } from '@tiptap/react';
import Navbar from '@/components/Navbar';
import NewManuscriptWizard from '@/components/collaboration/NewManuscriptWizard';
import type { WizardResult } from '@/components/collaboration/NewManuscriptWizard';
import EditorToolbar from '@/components/collaboration/EditorToolbar';
import CitationDialog from '@/components/collaboration/CitationDialog';
import ReferencesSection from '@/components/collaboration/ReferencesSection';
import CommentThread from '@/components/collaboration/CommentThread';
import SubmitToJournalDialog from '@/components/publication/SubmitToJournalDialog';
import ReformatPanel from '@/components/collaboration/ReformatPanel';
import LoadingScreen from '@/components/LoadingScreen';
import JLoadingGlyph from '@/components/JLoadingGlyph';
import { useManuscript } from '@/contexts/ManuscriptContext';
import type { CitationFormData, CommentFormData, DocumentSection, ManuscriptType } from '@/types';
import { format } from 'date-fns';
import { exportToDocx, exportToPdf, importDocx, importPdf, importImage, type ImportDocumentResult } from '@/lib/document-io';
import { normalizeSectionMatchKey } from '@shared/document-parse';
import {
  commitImportSession,
  createImportSession,
  patchImportSession,
  type FormatCheckSafeActionDTO,
  type ManuscriptImportSessionDTO,
} from '@/lib/api/backend';
import { normalizeImportedHtml, normalizePlainImportedText } from '@/lib/import-normalization';
import { toast } from 'sonner';
import { countWordsFromHtml } from '@shared/word-count';
import '@/components/collaboration/editor-styles.css';

const sectionStatusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  complete: { color: 'text-status-completed', icon: CheckCircle },
  active: { color: 'text-status-progress', icon: Circle },
  draft: { color: 'text-status-pending', icon: Circle },
  pending: { color: 'text-muted-foreground', icon: Circle },
};

type ViewTab = 'editor' | 'references' | 'comments';
interface PendingImportReview {
  result: ImportDocumentResult;
  session: ManuscriptImportSessionDTO | null;
  blockAssignments: Record<string, string>;
  figureAssignments: Record<string, string>;
  tableAssignments: Record<string, string>;
}

// Word limits per section for grant applications (words)
const GRANT_SECTION_LIMITS: Record<string, number> = {
  'Specific Aims': 500,
  'Background & Significance': 1500,
  'Innovation': 600,
  'Approach': 3000,
  'Budget Justification': 500,
  'Team & Qualifications': 600,
};

// Databases for literature review
const LIT_DATABASES = ['PubMed/MEDLINE', 'Cochrane Library', 'Embase', 'Web of Science', 'Scopus', 'CINAHL', 'PsycINFO'];

function countWords(html: string): number {
  return countWordsFromHtml(html);
}

function mapCommittedSection(section: {
  id: string;
  title: string;
  content_html: string;
  status: 'complete' | 'active' | 'draft' | 'pending';
  sort_order: number;
  last_edited_by?: string | null;
  last_edited_at?: string | null;
}): DocumentSection {
  // last_edited_by can be a UUID, 'Imported', 'Format Check', or a user name
  // UUIDs are 36 chars with hyphens (e.g., "550e8400-e29b-41d4-a716-446655440000")
  const isUuid = section.last_edited_by && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(section.last_edited_by);

  return {
    id: section.id,
    title: section.title,
    content: section.content_html || '<p></p>',
    status: section.status,
    order: section.sort_order,
    lastEditedBy: isUuid ? 'Unknown' : (section.last_edited_by ?? undefined),
    lastEditedAt: section.last_edited_at ? new Date(section.last_edited_at) : undefined,
  };
}

function mapCommittedCitation(citation: {
  id: string;
  authors: string[];
  title: string;
  publication_year: number | null;
  doi: string | null;
  url: string | null;
  citation_type: 'article' | 'book' | 'website' | 'conference';
  metadata: Record<string, unknown> | null;
}): CitationFormData & { id: string } {
  const metadata = (citation.metadata ?? {}) as Record<string, unknown>;
  return {
    id: citation.id,
    authors: citation.authors ?? [],
    title: citation.title,
    year: citation.publication_year ?? new Date().getFullYear(),
    journal: typeof metadata.journal === 'string' ? metadata.journal : undefined,
    doi: citation.doi ?? undefined,
    url: citation.url ?? undefined,
    type: citation.citation_type,
    volume: typeof metadata.volume === 'string' ? metadata.volume : undefined,
    issue: typeof metadata.issue === 'string' ? metadata.issue : undefined,
    pages: typeof metadata.pages === 'string' ? metadata.pages : undefined,
    publisher: typeof metadata.publisher === 'string' ? metadata.publisher : undefined,
    metadata,
    freePdfUrl: typeof metadata.freePdfUrl === 'string' ? metadata.freePdfUrl : undefined,
    oaStatus:
      metadata.oaStatus === 'gold' ||
      metadata.oaStatus === 'hybrid' ||
      metadata.oaStatus === 'bronze' ||
      metadata.oaStatus === 'green' ||
      metadata.oaStatus === 'closed'
        ? metadata.oaStatus
        : undefined,
  };
}

export default function Collaboration() {
  const {
    manuscripts,
    activeManuscriptId,
    manuscript,
    setActiveManuscriptId,
    createManuscript,
    deleteManuscript,
    manuscriptTypeLabels,
    activeSection,
    setActiveSection,
    updateTitle,
    updateSectionContent,
    addCitation,
    addCitations,
    removeCitation,
    addComment,
    removeComment,
    resolveComment,
    getSectionByTitle,
    replaceSections,
    replaceManuscriptContent,
    isHydrating,
  } = useManuscript();

  const project = { collaborators: [] as { id: string; name: string; initials: string; online: boolean; role?: string }[] };

const [isCitationDialogOpen, setIsCitationDialogOpen] = useState(false);

  const isPlaceholderSectionContent = (html?: string | null) => {
    const value = (html || '').trim();
    if (!value || value === '<p></p>') return true;
    if (/<img\b|<table\b|<ol\b|<ul\b|<li\b|<figure\b/i.test(value)) return false;

    const withoutComments = value.replace(/<!--[\s\S]*?-->/g, '');
    const withoutHeadings = withoutComments.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, '');
    const withoutEmptyParagraphs = withoutHeadings.replace(/<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
    const text = withoutEmptyParagraphs
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.length === 0;
  };

  const nonBlockingImportWarnings = (result: ImportDocumentResult) =>
    result.diagnostics.filter((d) => d.level !== 'info' && !(result.sourceFormat === 'docx' && d.code === 'DOCX_PARSE_WARNING'));
  const [activeTab, setActiveTab] = useState<ViewTab>('editor');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(manuscript.title);
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isReformatting, setIsReformatting] = useState(false);
  const [pendingImportReview, setPendingImportReview] = useState<PendingImportReview | null>(null);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('journi.editor.info-panel.open');
      return raw === null ? true : raw === '1';
    } catch {
      return true;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reformatOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Text selection comment state
  const [selectedText, setSelectedText] = useState('');
  const [showCommentPopup, setShowCommentPopup] = useState(false);
  const [commentPopupPos, setCommentPopupPos] = useState({ top: 0, left: 0 });
  const [inlineCommentText, setInlineCommentText] = useState('');
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const inlineCommentInputRef = useRef<HTMLInputElement>(null);
  const [tableContextMenuPos, setTableContextMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Document switcher
  const [showDocSwitcher, setShowDocSwitcher] = useState(false);
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState<ManuscriptType>('full_paper');

  // New manuscript wizard
  const [showWizard, setShowWizard] = useState(false);

  // Resize table dialog (replaces window.prompt)
  const [resizeDialog, setResizeDialog] = useState<{ open: boolean; rows: string; cols: string } | null>(null);

  // Rename section inline (replaces window.prompt)
  const [renamingSection, setRenamingSection] = useState<{ id: string; value: string } | null>(null);

  // Submit to journal dialog
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Reformat panel
  const [isReformatOpen, setIsReformatOpen] = useState(false);

  // Literature review â€” search strategy tracker
  const [litSearchDbs, setLitSearchDbs] = useState<string[]>(['PubMed/MEDLINE']);
  const [litPrisma, setLitPrisma] = useState({ identified: 0, screened: 0, eligible: 0, included: 0 });
  const [litDateRange, setLitDateRange] = useState('');

  // Grant application â€” budget tracker + agency
  const [grantAgency, setGrantAgency] = useState('');
  const [grantBudgetItems, setGrantBudgetItems] = useState<{ name: string; amount: number }[]>([
    { name: 'Personnel', amount: 0 },
    { name: 'Equipment', amount: 0 },
    { name: 'Indirect Costs', amount: 0 },
  ]);

  // Sync title draft when manuscript changes
  useEffect(() => {
    setTitleDraft(manuscript.title);
  }, [manuscript.title, activeManuscriptId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('journi.editor.info-panel.open', isInfoPanelOpen ? '1' : '0');
    } catch {
      // Ignore storage failures.
    }
  }, [isInfoPanelOpen]);

  useEffect(() => {
    return () => {
      if (reformatOverlayTimerRef.current) {
        clearTimeout(reformatOverlayTimerRef.current);
      }
    };
  }, []);

  // "Everything" view
  const isEverythingView = activeSection === '__everything__';

  // Check if the manuscript is "empty" â€” no section has any actual prose.
  // Template subheadings (h2/h3) count as content so templated documents
  // bypass the onboarding screen and open directly in the editor.
  const isManuscriptEmpty = useMemo(() => {
    return manuscript.sections.every((s) => countWords(s.content) === 0);
  }, [manuscript.sections]);

  // Get current section data
  const currentSection = isEverythingView ? null : getSectionByTitle(activeSection);
  const sectionContent = currentSection?.content || '';
  const sectionId = currentSection?.id || '';

  // Get comments for current section
  const sectionComments = manuscript.comments.filter((c) => c.sectionId === sectionId);
  const unresolvedCommentsCount = sectionComments.filter((c) => !c.resolved).length;

  // Word counts per section
  const sectionWordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const section of manuscript.sections) {
      counts[section.title] = countWords(section.content);
    }
    return counts;
  }, [manuscript.sections]);

  const totalWordCount = useMemo(
    () => Object.values(sectionWordCounts).reduce((sum, c) => sum + c, 0),
    [sectionWordCounts]
  );

  const currentWordCount = sectionWordCounts[activeSection] || 0;

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-journi-green hover:underline cursor-pointer' },
      }),
      Underline,
      Color,
      TextStyle,
      BulletList.configure({ HTMLAttributes: { class: 'list-disc list-outside ml-6' } }),
      OrderedList.configure({ HTMLAttributes: { class: 'list-decimal list-outside ml-6' } }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: sectionContent,
    editable: true,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none text-foreground/80 leading-relaxed space-y-4 focus:outline-none min-h-[500px]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      if (sectionId) {
        updateSectionContent(sectionId, html);
      }
    },
  });

  // Update editor content when section changes
  useMemo(() => {
    if (editor && sectionContent !== editor.getHTML()) {
      editor.commands.setContent(sectionContent);
    }
  }, [activeSection, sectionContent, editor, activeManuscriptId]);

  // Listen for text selection in the editor to show "comment on selection" popup
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !editorContainerRef.current) {
          setShowCommentPopup(false);
          setSelectedText('');
          return;
        }

        const text = selection.toString().trim();
        if (text.length < 2) {
          setShowCommentPopup(false);
          return;
        }

        const range = selection.getRangeAt(0);
        if (!editorContainerRef.current.contains(range.commonAncestorContainer)) {
          setShowCommentPopup(false);
          return;
        }

        const rect = range.getBoundingClientRect();
        const containerRect = editorContainerRef.current.getBoundingClientRect();

        setSelectedText(text.substring(0, 200));
        setCommentPopupPos({
          top: rect.top - containerRect.top - 44,
          left: rect.left - containerRect.left + rect.width / 2,
        });
        setShowCommentPopup(true);
        setInlineCommentText('');
      }, 10);
    };

    const container = editorContainerRef.current;
    if (container) {
      container.addEventListener('mouseup', handleMouseUp);
      return () => container.removeEventListener('mouseup', handleMouseUp);
    }
  }, []);

  const handleInlineComment = () => {
    if (!inlineCommentText.trim() || !selectedText) return;
    addComment({
      content: inlineCommentText.trim(),
      sectionId,
      quotedText: selectedText,
    });
    setInlineCommentText('');
    setShowCommentPopup(false);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
    toast.success('Comment added on selected text');
  };

  const getSelectedTableSize = () => {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
    const tableElement = anchorElement?.closest('table');

    if (!tableElement) return null;

    const rows = tableElement.querySelectorAll('tr').length;
    const cols = tableElement.querySelector('tr')?.querySelectorAll('th, td').length ?? 0;

    if (rows < 1 || cols < 1) return null;
    return { rows, cols };
  };

  const handleResizeTable = () => {
    if (!editor) return;
    const currentSize = getSelectedTableSize();
    if (!currentSize) return;
    setResizeDialog({ open: true, rows: String(currentSize.rows), cols: String(currentSize.cols) });
    setTableContextMenuPos(null);
  };

  const applyResizeTable = () => {
    if (!editor || !resizeDialog) return;
    const currentSize = getSelectedTableSize();
    if (!currentSize) { setResizeDialog(null); return; }

    const nextRows = Number.parseInt(resizeDialog.rows, 10);
    const nextCols = Number.parseInt(resizeDialog.cols, 10);

    if (!Number.isInteger(nextRows) || !Number.isInteger(nextCols) || nextRows < 1 || nextCols < 1) {
      toast.error('Please enter valid positive integers for rows and columns.');
      return;
    }

    if (nextRows > currentSize.rows) {
      for (let i = 0; i < nextRows - currentSize.rows; i += 1) editor.chain().focus().addRowAfter().run();
    } else if (nextRows < currentSize.rows) {
      for (let i = 0; i < currentSize.rows - nextRows; i += 1) editor.chain().focus().deleteRow().run();
    }
    if (nextCols > currentSize.cols) {
      for (let i = 0; i < nextCols - currentSize.cols; i += 1) editor.chain().focus().addColumnAfter().run();
    } else if (nextCols < currentSize.cols) {
      for (let i = 0; i < currentSize.cols - nextCols; i += 1) editor.chain().focus().deleteColumn().run();
    }
    setResizeDialog(null);
  };

  const handleEditorContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    if (!editor || !editorContainerRef.current) return;

    const target = e.target as HTMLElement;
    const tableCell = target.closest('td, th');
    if (!tableCell) return;

    e.preventDefault();

    const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (pos) {
      editor.chain().focus().setTextSelection(pos.pos).run();
    }

    const containerRect = editorContainerRef.current.getBoundingClientRect();
    setTableContextMenuPos({
      top: e.clientY - containerRect.top + 8,
      left: e.clientX - containerRect.left + 8,
    });
    setShowCommentPopup(false);
  };

  useEffect(() => {
    const hideTableContextMenu = () => setTableContextMenuPos(null);
    window.addEventListener('scroll', hideTableContextMenu, true);
    window.addEventListener('resize', hideTableContextMenu);
    return () => {
      window.removeEventListener('scroll', hideTableContextMenu, true);
      window.removeEventListener('resize', hideTableContextMenu);
    };
  }, []);

  const handleCitationSubmit = (citation: CitationFormData) => {
    addCitation(citation);
  };

  const handleCommentSubmit = (comment: CommentFormData) => {
    addComment(comment);
  };

  const handleTitleSave = () => {
    if (titleDraft.trim()) {
      updateTitle(titleDraft.trim());
    } else {
      setTitleDraft(manuscript.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setTitleDraft(manuscript.title);
      setIsEditingTitle(false);
    }
  };

  // Export handlers
  const handleExportDocx = async () => {
    setIsExporting('docx');
    try {
      await exportToDocx(manuscript);
      toast.success('Exported as Word document');
    } catch (err) {
      console.error('DOCX export failed:', err);
      toast.error('Failed to export as Word document');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting('pdf');
    try {
      await exportToPdf(manuscript);
      toast.success('Exported as PDF');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export as PDF');
    } finally {
      setIsExporting(null);
    }
  };

  const applyImportedResult = (result: ImportDocumentResult) => {
    // This should never happen now due to fallback in document-io.ts, but handle gracefully
    if (!result.sections.length) {
      toast.error('No content found in the file. The file may be empty or corrupted.');
      return;
    }

    // Always update title from import result
    if (result.title?.trim()) {
      updateTitle(normalizePlainImportedText(result.title, { trim: true }));
    }

    if (result.citations.length > 0) {
      addCitations(
        result.citations.map((citation) => ({
          ...citation,
          authors: citation.authors.map((author) => normalizePlainImportedText(author, { trim: true })),
          title: normalizePlainImportedText(citation.title, { trim: true }),
          journal: citation.journal ? normalizePlainImportedText(citation.journal, { trim: true }) : undefined,
          doi: citation.doi ? normalizePlainImportedText(citation.doi, { trim: true }) : undefined,
          url: citation.url ? normalizePlainImportedText(citation.url, { trim: true }) : undefined,
        })),
      );
    }

    const existingSections = [...manuscript.sections];
    const contentSections = existingSections.filter((s) => normalizeSectionMatchKey(s.title) !== 'title');
    const isManuscriptCurrentlyEmpty = contentSections.every((s) => isPlaceholderSectionContent(s.content));

    // If manuscript is empty, directly replace with imported sections (preserves structure)
    if (isManuscriptCurrentlyEmpty) {
      const importedSections: DocumentSection[] = result.sections.map((s, i) => ({
        id: `imported-${Date.now()}-${i}`,
        title: normalizePlainImportedText(s.title || `Section ${i + 1}`, { trim: true }) || `Section ${i + 1}`,
        content: normalizeImportedHtml(s.content || '<p></p>'),
        status: 'draft' as const,
        order: i,
        lastEditedBy: 'Imported',
        lastEditedAt: new Date(),
      }));
      replaceSections(importedSections);
      toast.success(`Imported ${result.sections.length} section(s) from ${result.fileName}`);

      if (result.citations.length > 0) {
        toast.success(`${result.citations.length} citation(s) imported`);
      }

      const warnings = nonBlockingImportWarnings(result);
      if (warnings.length > 0) toast.warning(warnings[0].message);
      return;
    }

    // Manuscript has content - do section matching
    let matchedCount = 0;
    let addedCount = 0;
    const unmatchedImported: Partial<DocumentSection>[] = [];
    const findMatchingSection = (title: string) => {
      const trimmedTitle = title.trim().toLowerCase();
      const exact = existingSections.find((s) => s.title.trim().toLowerCase() === trimmedTitle);
      if (exact) return exact;

      const importedKey = normalizeSectionMatchKey(title);
      return existingSections.find((s) => normalizeSectionMatchKey(s.title) === importedKey);
    };

    for (const imported of result.sections) {
      const normalizedImportedTitle = normalizePlainImportedText(imported.title || '', { trim: true });
      const importedTitle = normalizedImportedTitle.toLowerCase();
      const match = findMatchingSection(normalizedImportedTitle);

      if (match) {
        updateSectionContent(match.id, normalizeImportedHtml(imported.content || '<p></p>'));
        matchedCount++;
      } else {
        const genericTitles = ['content', 'untitled section'];
        const isGeneric = genericTitles.includes(importedTitle);

        if (isGeneric && result.sections.length === 1) {
          const activeS = getSectionByTitle(activeSection);
          if (activeS) {
            updateSectionContent(activeS.id, normalizeImportedHtml(imported.content || '<p></p>'));
            matchedCount++;
          } else {
            unmatchedImported.push(imported);
          }
        } else {
          unmatchedImported.push(imported);
        }
      }
    }

    if (unmatchedImported.length > 0) {
      const newSections: DocumentSection[] = [
        ...existingSections,
        ...unmatchedImported.map((s, i) => ({
          id: `imported-${Date.now()}-${i}`,
          title: normalizePlainImportedText(s.title || `Imported Section ${i + 1}`, { trim: true }) || `Imported Section ${i + 1}`,
          content: normalizeImportedHtml(s.content || '<p></p>'),
          status: 'draft' as const,
          order: existingSections.length + i,
          lastEditedBy: 'Imported',
          lastEditedAt: new Date(),
        })),
      ];
      replaceSections(newSections);
      addedCount = unmatchedImported.length;
    }

    const parts: string[] = [];
    if (matchedCount > 0) parts.push(`${matchedCount} section(s) updated`);
    if (addedCount > 0) parts.push(`${addedCount} new section(s) added`);
    if (result.citations.length > 0) parts.push(`${result.citations.length} citation(s) imported`);
    toast.success(`Imported: ${parts.join(', ') || 'content loaded'}`);

    const warnings = nonBlockingImportWarnings(result);
    if (warnings.length > 0) toast.warning(warnings[0].message);
  };

  const createServerImportSession = async (result: ImportDocumentResult): Promise<ManuscriptImportSessionDTO | null> => {
    try {
      const response = await createImportSession({
        manuscriptId: manuscript.id,
        fileName: result.fileName,
        fileTitle: result.title,
        sourceFormat: result.sourceFormat,
        reviewRequired: result.review.required,
        status: result.status === 'committed' ? 'ready_to_commit' : result.status,
        unsupportedReason: result.unsupportedReason,
        diagnostics: result.diagnostics,
        items: result.items,
      });
      return response.data;
    } catch {
      return null;
    }
  };

  const hasReviewableImportContent = (result: ImportDocumentResult) =>
    result.review.blocks.length > 0 || result.review.figures.length > 0 || result.review.tables.length > 0;

  const buildReviewableSections = (
    result: ImportDocumentResult,
    blockAssignments: Record<string, string>,
    figureAssignments: Record<string, string>,
    tableAssignments: Record<string, string>,
  ): Partial<DocumentSection>[] => {
    const htmlBySection = new Map<string, string[]>();
    const push = (sectionTitle: string, html: string) => {
      const existing = htmlBySection.get(sectionTitle) || [];
      existing.push(html);
      htmlBySection.set(sectionTitle, existing);
    };

    for (const block of result.review.blocks) {
      const sectionTitle = blockAssignments[block.id] || block.suggestedSection || 'Content';
      const text = normalizePlainImportedText(block.text || '', { trim: true });
      if (!text) continue;
      if (block.type === 'caption' || block.type === 'table') continue;
      if (block.type === 'reference') push(sectionTitle, `<p>${text}</p>`);
      else push(sectionTitle, `<p>${text}</p>`);
    }

    for (const figure of result.review.figures) {
      const sectionTitle = figureAssignments[figure.id] || 'Results & Synthesis';
      const caption = normalizePlainImportedText(figure.caption || '', { trim: true });
      push(
        sectionTitle,
        `<figure><img src="${figure.imageData}" alt="${caption || 'Imported figure'}" style="max-width:100%" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`,
      );
    }

    for (const table of result.review.tables) {
      const sectionTitle = tableAssignments[table.id] || 'Results & Synthesis';
      push(sectionTitle, normalizeImportedHtml(table.html));
      if (table.caption) push(sectionTitle, `<p><em>${normalizePlainImportedText(table.caption, { trim: true })}</em></p>`);
    }

    return Array.from(htmlBySection.entries()).map(([title, parts]) => ({
      title,
      content: normalizeImportedHtml(parts.join('\n')),
    }));
  };

  const openImportReview = (result: ImportDocumentResult, session: ManuscriptImportSessionDTO | null) => {
    const existingTitles = new Set(manuscript.sections.map((section) => section.title.trim()).filter(Boolean));
    const defaultSection = existingTitles.has('Content') ? 'Content' : (manuscript.sections[0]?.title || 'Content');
    const resolve = (suggested?: string) => (suggested && suggested.trim() ? suggested : defaultSection);

    const blockAssignments: Record<string, string> = {};
    for (const block of result.review.blocks) {
      blockAssignments[block.id] = block.type === 'reference' ? resolve('References') : resolve(block.suggestedSection);
    }
    const figureAssignments: Record<string, string> = {};
    for (const figure of result.review.figures) figureAssignments[figure.id] = resolve('Results & Synthesis');
    const tableAssignments: Record<string, string> = {};
    for (const table of result.review.tables) tableAssignments[table.id] = resolve('Results & Synthesis');

    setPendingImportReview({ result, session, blockAssignments, figureAssignments, tableAssignments });
  };

  const handleAcceptImportReview = () => {
    if (!pendingImportReview) return;
    const { result, session, blockAssignments, figureAssignments, tableAssignments } = pendingImportReview;
    const sections = buildReviewableSections(result, blockAssignments, figureAssignments, tableAssignments);

    if (!session) {
      applyImportedResult({ ...result, sections: sections.length > 0 ? sections : result.sections });
      setPendingImportReview(null);
      toast.success('Import review accepted and applied locally.');
      return;
    }

    const nextItems = session.items.map((item) => {
      if (item.type === 'reference') {
        return {
          ...item,
          assignedSectionTitle: 'References',
          decision: 'accepted' as const,
        };
      }

      if (item.type === 'figure_caption') {
        return {
          ...item,
          assignedSectionTitle: figureAssignments[item.id] || item.assignedSectionTitle || 'Results & Synthesis',
          decision: 'accepted' as const,
        };
      }

      if (item.type === 'table_candidate') {
        return {
          ...item,
          assignedSectionTitle: tableAssignments[item.id] || item.assignedSectionTitle || 'Results & Synthesis',
          decision: 'accepted' as const,
        };
      }

      return {
        ...item,
        assignedSectionTitle: blockAssignments[item.id] || item.assignedSectionTitle || item.proposedSectionTitle || 'Content',
        decision: item.type === 'manual_only' ? 'rejected' as const : 'accepted' as const,
      };
    });

    void (async () => {
      setIsImporting(true);
      try {
        await patchImportSession(session.id, {
          status: 'ready_to_commit',
          items: nextItems,
        });
        const committed = await commitImportSession(session.id);
        if (result.title?.trim()) {
          updateTitle(normalizePlainImportedText(result.title, { trim: true }));
        }
        replaceManuscriptContent({
          sections: committed.data.sections.map(mapCommittedSection),
          citations: committed.data.citations.map(mapCommittedCitation),
        });
        toast.success('Import review accepted and committed.');
      } catch (err) {
        console.error('Import session commit failed:', err);
        toast.error('Failed to commit reviewed import. Your review choices were not applied.');
      } finally {
        setIsImporting(false);
        setPendingImportReview(null);
      }
    })();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let result: ImportDocumentResult;

      if (ext === 'docx') result = await importDocx(file);
      else if (ext === 'pdf') result = await importPdf(file);
      else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') result = await importImage(file);
      else {
        toast.error('Unsupported file type. Please use .docx, .pdf, or an image file.');
        return;
      }

      if (result.status === 'unsupported' || result.status === 'manual_only') {
        toast.error(result.unsupportedReason || 'This file requires manual handling in the deterministic import flow.');
        return;
      }

      const session = await createServerImportSession(result);

      if (result.review.required && hasReviewableImportContent(result)) {
        openImportReview(result, session);
        toast.message('Review required', { description: 'Approve extracted content before it is committed.' });
        return;
      }

      if (session) {
        const nextItems = session.items.map((item) => ({
          ...item,
          decision: item.type === 'manual_only' ? 'rejected' as const : 'accepted' as const,
        }));

        try {
          await patchImportSession(session.id, {
            status: 'ready_to_commit',
            items: nextItems,
          });
          const committed = await commitImportSession(session.id);
          if (result.title?.trim()) {
            updateTitle(normalizePlainImportedText(result.title, { trim: true }));
          }
          replaceManuscriptContent({
            sections: committed.data.sections.map(mapCommittedSection),
            citations: committed.data.citations.map(mapCommittedCitation),
          });
          toast.success('Imported and committed.');
          return;
        } catch (err) {
          console.error('Import session auto-commit failed:', err);
          toast.error('Automatic commit failed. Falling back to local import preview.');
        }
      }

      applyImportedResult(result);
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Failed to import file. Please try a different file.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyFormatAction = (action: FormatCheckSafeActionDTO) => {
    setIsReformatting(true);
    if (reformatOverlayTimerRef.current) {
      clearTimeout(reformatOverlayTimerRef.current);
    }
    const finishReformat = () => {
      reformatOverlayTimerRef.current = setTimeout(() => {
        setIsReformatting(false);
      }, 550);
    };

    if (action.type === 'rename_heading' && action.sectionId && action.details?.toTitle) {
      replaceSections(
        manuscript.sections.map((section) =>
          section.id === action.sectionId
            ? { ...section, title: String(action.details?.toTitle) }
            : section,
        ),
      );
      finishReformat();
      return;
    }

    if (action.type === 'insert_missing_section' && action.details?.targetTitle) {
      const title = String(action.details.targetTitle);
      if (manuscript.sections.some((section) => section.title.trim().toLowerCase() === title.trim().toLowerCase())) {
        finishReformat();
        return;
      }
      replaceSections([
        ...manuscript.sections,
        {
          id: `format-${Date.now()}-${title.toLowerCase().replace(/\s+/g, '-')}`,
          title,
          content: '<p></p>',
          status: 'pending',
          order: manuscript.sections.length,
          lastEditedBy: 'Format Check',
          lastEditedAt: new Date(),
        },
      ]);
      finishReformat();
      return;
    }

    if (action.type === 'apply_structured_abstract_template' && action.sectionId && action.details?.templateHtml) {
      updateSectionContent(action.sectionId, String(action.details.templateHtml));
      finishReformat();
      return;
    }

    if (action.type === 'reorder_sections') {
      const orderedTitles = Array.isArray(action.details?.orderedTitles)
        ? action.details?.orderedTitles.map((title) => String(title).trim().toLowerCase())
        : [];
      if (orderedTitles.length === 0) {
        finishReformat();
        return;
      }

      const withIndex = manuscript.sections.map((section, index) => ({ section, index }));
      withIndex.sort((a, b) => {
        const aIndex = orderedTitles.indexOf(a.section.title.trim().toLowerCase());
        const bIndex = orderedTitles.indexOf(b.section.title.trim().toLowerCase());
        const left = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
        const right = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
        return left === right ? a.index - b.index : left - right;
      });

      replaceSections(
        withIndex.map(({ section }, index) => ({
          ...section,
          order: index,
        })),
      );
    }

    finishReformat();
  };

  // Create new document
  const handleCreateDocument = () => {
    if (!newDocTitle.trim()) {
      toast.error('Please enter a document title');
      return;
    }
    createManuscript(newDocTitle.trim(), newDocType);
    setNewDocTitle('');
    setNewDocType('full_paper');
    setShowNewDocForm(false);
    setShowDocSwitcher(false);
    toast.success('New document created');
  };

  // Handle wizard completion
  const handleWizardComplete = async (result: WizardResult) => {
    setShowWizard(false);
    setShowDocSwitcher(false);

    if (result.action === 'import' && result.file) {
      // Parse the file first, then create the manuscript and apply content.
      // This avoids a race condition where createManuscript fires an async backend
      // call in the background and the import session ends up using a stale optimistic ID.
      setIsImporting(true);
      try {
        const ext = result.file.name.split('.').pop()?.toLowerCase();
        let importResult: ImportDocumentResult;
        if (ext === 'docx') importResult = await importDocx(result.file);
        else if (ext === 'pdf') importResult = await importPdf(result.file);
        else importResult = await importImage(result.file);

        const derivedTitle = importResult.title || result.title;
        createManuscript(derivedTitle, result.type);
        applyImportedResult(importResult);
      } catch (err) {
        console.error('Import failed:', err);
        toast.error('Failed to import file. Please try a different file.');
      } finally {
        setIsImporting(false);
      }
    } else {
      createManuscript(result.title, result.type);
      toast.success('New document created \u2014 start writing!');
    }

    if (result.journal) {
      toast.success(`Target journal: ${result.journal.name}`, { duration: 4000 });
    }
  };

  // Delete document
  const handleDeleteDocument = (id: string) => {
    if (window.confirm('Delete this document? This cannot be undone.')) {
      deleteManuscript(id);
      toast.success('Document deleted');
    }
  };

  // Rename section (subsection) from left sidebar
  const handleRenameSection = (sectionId: string) => {
    const section = manuscript.sections.find((s) => s.id === sectionId);
    if (!section) return;
    setRenamingSection({ id: sectionId, value: section.title });
  };

  const applyRenameSection = () => {
    if (!renamingSection) return;
    const { id: sectionId, value: nextTitleInput } = renamingSection;
    const nextTitle = nextTitleInput.trim();

    if (!nextTitle) {
      toast.error('Subsection name cannot be empty');
      return;
    }

    const duplicateExists = manuscript.sections.some(
      (s) => s.id !== sectionId && s.title.trim().toLowerCase() === nextTitle.toLowerCase()
    );
    if (duplicateExists) {
      toast.error('A subsection with that name already exists');
      setRenamingSection(null);
      return;
    }

    const updatedSections = manuscript.sections.map((s) =>
      s.id === sectionId ? { ...s, title: nextTitle } : s
    );
    const section = manuscript.sections.find((s) => s.id === sectionId);
    replaceSections(updatedSections);
    if (section && activeSection === section.title) {
      setActiveSection(nextTitle);
    }
    toast.success('Subsection renamed');
    setRenamingSection(null);
  };

  // Delete section (subsection) from left sidebar
  const handleDeleteSection = (sectionId: string) => {
    if (manuscript.sections.length <= 1) {
      toast.error('Cannot delete the only subsection');
      return;
    }

    const section = manuscript.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentIndex = manuscript.sections.findIndex((s) => s.id === sectionId);
    const updatedSections = manuscript.sections.filter((s) => s.id !== sectionId);
    replaceSections(updatedSections);

    if (activeSection === section.title) {
      const fallbackIndex = Math.max(0, currentIndex - 1);
      setActiveSection(updatedSections[fallbackIndex]?.title || updatedSections[0].title);
      setActiveTab('editor');
    }

    toast.success('Subsection deleted');
  };

  // Determine section status
  const getSectionStatus = (sectionTitle: string) => {
    const section = getSectionByTitle(sectionTitle);
    if (!section) return 'pending';
    const hasContent = section.content && section.content !== '<p></p>';
    const hasUnresolvedComments =
      manuscript.comments.filter((c) => c.sectionId === section.id && !c.resolved).length > 0;
    if (!hasContent) return 'pending';
    if (hasUnresolvedComments) return 'draft';
    if (hasContent && !hasUnresolvedComments) return 'complete';
    return 'active';
  };

  const documentSections = manuscript.sections.map((section) => ({
    id: section.id,
    title: section.title,
    status: getSectionStatus(section.title),
  }));

  const onlineMembers = project.collaborators.filter((c) => c.online);

  // ========================================
  // Onboarding screen (when manuscript is empty)
  // ========================================
  // Zero manuscripts â€” "Get Started" screen
  // ========================================
  if (manuscripts.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <Navbar />
        <div className="flex flex-1 pt-16 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-lg w-full mx-4"
          >
            <div className="bg-card rounded-2xl border border-border p-10 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-journi-green/10 flex items-center justify-center mx-auto mb-6">
                <FilePlus2 size={32} className="text-journi-green" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">Get Started</h1>
              <p className="text-sm text-muted-foreground mb-8">
                Create a new manuscript or import an existing paper to begin.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setShowWizard(true)}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-medium text-white bg-journi-green hover:bg-journi-green/90 rounded-xl transition-colors"
                >
                  <FilePlus2 size={18} />
                  Start new manuscript
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-medium text-foreground bg-accent hover:bg-accent/80 rounded-xl transition-colors disabled:opacity-50 border border-border"
                >
                  {isImporting ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                  {isImporting ? 'Importing...' : 'Already started? Import your paper (.docx or .pdf)'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={handleImportFile}
        />

        <NewManuscriptWizard
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
          manuscriptTypeLabels={manuscriptTypeLabels}
        />
      </div>
    );
  }

  // ========================================
  if (isManuscriptEmpty && !isEverythingView) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <Navbar />
        <div className="flex flex-1 pt-16 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-lg w-full mx-4"
          >
            <div className="bg-card rounded-2xl border border-border p-10 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-journi-green/10 flex items-center justify-center mx-auto mb-6">
                <FileText size={32} className="text-journi-green" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {manuscript.title}
              </h1>
              <p className="text-sm text-muted-foreground mb-1">
                {manuscriptTypeLabels[manuscript.type]}
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                {manuscript.sections.length} sections ready to be written
              </p>

              <div className="space-y-3">
                {/* Open wizard */}
                <button
                  onClick={() => setShowWizard(true)}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-medium text-white bg-journi-green hover:bg-journi-green/90 rounded-xl transition-colors"
                >
                  <FilePlus2 size={18} />
                  Start new manuscript
                </button>

                {/* Quick import fallback */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-medium text-foreground bg-accent hover:bg-accent/80 rounded-xl transition-colors disabled:opacity-50 border border-border"
                >
                  {isImporting ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                  {isImporting ? 'Importing...' : 'Already started? Import your paper (.docx or .pdf)'}
                </button>
              </div>

              {/* Document switcher */}
              {manuscripts.length > 1 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Or switch to another document:</p>
                  <div className="space-y-1.5">
                    {manuscripts.filter((m) => m.id !== activeManuscriptId).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveManuscriptId(m.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors text-left"
                      >
                        <FileText size={14} />
                        <span className="flex-1 truncate">{m.title}</span>
                        <span className="text-[10px] text-muted-foreground">{manuscriptTypeLabels[m.type]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={handleImportFile}
        />

        {/* New Manuscript Wizard */}
        <NewManuscriptWizard
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
          manuscriptTypeLabels={manuscriptTypeLabels}
        />
      </div>
    );
  }

  // ========================================
  // Main editor view
  // ========================================
  return (
    <div className="h-screen flex flex-col bg-muted/30">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* Document Outline Sidebar â€” fixed */}
        <aside className="hidden lg:flex flex-col w-56 bg-card border-r border-border pt-4 pb-4 shrink-0 fixed top-16 bottom-0 z-30">
          {/* Document Switcher */}
          <div className="px-3 mb-3">
            <button
              onClick={() => setShowDocSwitcher(!showDocSwitcher)}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-medium text-foreground bg-accent/60 hover:bg-accent rounded-lg transition-colors"
            >
              <FileText size={13} className="text-journi-green shrink-0" />
              <span className="flex-1 truncate">{manuscript.title}</span>
              <ChevronDown size={12} className={`text-muted-foreground transition-transform ${showDocSwitcher ? 'rotate-180' : ''}`} />
            </button>

            {showDocSwitcher && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-1.5 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
              >
                <div className="max-h-48 overflow-y-auto">
                  {manuscripts.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors ${
                        m.id === activeManuscriptId
                          ? 'bg-journi-green/10 text-journi-green font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setActiveManuscriptId(m.id);
                          setShowDocSwitcher(false);
                        }}
                        className="flex-1 text-left truncate"
                      >
                        {m.title}
                      </button>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {manuscriptTypeLabels[m.type]}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(m.id);
                        }}
                        className="p-0.5 rounded hover:bg-status-delayed/10 text-muted-foreground hover:text-status-delayed shrink-0"
                        title="Delete document"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* New document button â€” opens wizard */}
                <button
                  onClick={() => setShowWizard(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-journi-green hover:bg-journi-green/5 transition-colors border-t border-border"
                >
                  <Plus size={12} />
                  New Document
                </button>
              </motion.div>
            )}
          </div>

          {/* Title & Word Count */}
          <div className="px-4 mb-4">
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleTitleSave}
                  autoFocus
                  className="flex-1 min-w-0 text-sm font-semibold text-foreground bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
                <button
                  onClick={handleTitleSave}
                  className="p-1 text-journi-green hover:bg-journi-green/10 rounded"
                  title="Save title"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setTitleDraft(manuscript.title); setIsEditingTitle(true); }}
                className="group flex items-center gap-1.5 text-left w-full"
                title="Click to edit title"
              >
                <p className="text-sm font-semibold text-foreground truncate">{manuscript.title}</p>
                <Pencil size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
              </button>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <FileText size={10} />
                {totalWordCount.toLocaleString()} words
              </p>
              {manuscript.type === 'literature_review' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-bold">
                  <BookMarked size={8} />
                  Lit Review
                </span>
              )}
              {manuscript.type === 'grant_application' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-bold">
                  <DollarSign size={8} />
                  Grant
                </span>
              )}
            </div>
            {/* Show over-limit warning badge for grant in sidebar */}
            {manuscript.type === 'grant_application' && (() => {
              const overCount = manuscript.sections.filter(
                (s) => GRANT_SECTION_LIMITS[s.title] && (sectionWordCounts[s.title] || 0) > GRANT_SECTION_LIMITS[s.title]
              ).length;
              return overCount > 0 ? (
                <p className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={9} />
                  {overCount} section{overCount > 1 ? 's' : ''} over limit
                </p>
              ) : null;
            })()}
            {/* Show included study count for lit review */}
            {manuscript.type === 'literature_review' && litPrisma.included > 0 && (
              <p className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5">
                <Database size={9} />
                {litPrisma.included} studies included Â· {litSearchDbs.length} databases
              </p>
            )}
          </div>

          {/* Section navigation */}
          <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
            {documentSections.map((sec) => {
              const config = sectionStatusConfig[sec.status];
              const Icon = config.icon;
              const wc = sectionWordCounts[sec.title] || 0;
              return (
                <div
                  key={sec.id}
                  className={`group w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-colors
                    ${
                      activeSection === sec.title
                        ? 'bg-journi-green/10 text-journi-green'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  <button
                    onClick={() => {
                      setActiveSection(sec.title);
                      setActiveTab('editor');
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2.5 px-1 py-1 text-left"
                  >
                    <Icon size={14} className={config.color} />
                    <span className="flex-1 truncate">{sec.title}</span>
                    {manuscript.type === 'grant_application' && GRANT_SECTION_LIMITS[sec.title] && wc > GRANT_SECTION_LIMITS[sec.title] ? (
                      <AlertTriangle size={10} className="text-red-500 shrink-0" />
                    ) : null}
                    <span className={`text-[10px] tabular-nums ${manuscript.type === 'grant_application' && GRANT_SECTION_LIMITS[sec.title] && wc > GRANT_SECTION_LIMITS[sec.title] ? 'text-red-500' : 'text-muted-foreground'}`}>{wc}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameSection(sec.id);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Rename subsection"
                    type="button"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSection(sec.id);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-status-delayed hover:bg-status-delayed/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete subsection"
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}

            {/* Everything section */}
            <div className="pt-2 mt-2 border-t border-border">
              <button
                onClick={() => {
                  setActiveSection('__everything__');
                  setActiveTab('editor');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                  ${
                    isEverythingView
                      ? 'bg-journi-green/10 text-journi-green font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
              >
                <Layers size={14} className={isEverythingView ? 'text-journi-green' : ''} />
                <span className="flex-1 text-left">Everything</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{totalWordCount}</span>
              </button>
            </div>
          </nav>

          {/* Team Online */}
          <div className="px-4 pt-3 border-t border-border pb-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Team Online ({onlineMembers.length})
            </h3>
            <div className="flex -space-x-2">
              {onlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="relative w-8 h-8 rounded-full bg-journi-green/20 flex items-center justify-center text-[10px] font-bold text-journi-green border-2 border-card"
                  title={member.name}
                >
                  {member.initials}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-completed border-2 border-card" />
                </div>
              ))}
            </div>
          </div>

          {/* Reformat + Submit buttons */}
          <div className="px-3 pt-3 border-t border-border space-y-1.5">
            <button
              onClick={() => setIsReformatOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-journi-green/40 text-journi-green text-[11px] font-semibold rounded-lg hover:bg-journi-green/10 transition-colors"
            >
              <Wand2 size={12} />
              Reformat for Journal
            </button>
            <button
              onClick={() => setSubmitDialogOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-journi-green text-journi-slate text-[11px] font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <Send size={12} />
              Submit Paper
            </button>
          </div>

          {/* Export */}
          <div className="px-3 pt-3 pb-3 border-border space-y-1.5">
            <div className="flex gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-foreground bg-accent hover:bg-accent/80 rounded-md transition-colors disabled:opacity-50"
              >
                {isImporting ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
                Import
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleExportDocx}
                disabled={isExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-foreground bg-accent hover:bg-accent/80 rounded-md transition-colors disabled:opacity-50"
              >
                {isExporting === 'docx' ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                Word
              </button>
              <button
                onClick={handleExportPdf}
                disabled={isExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-foreground bg-accent hover:bg-accent/80 rounded-md transition-colors disabled:opacity-50"
              >
                {isExporting === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                PDF
              </button>
            </div>
          </div>
        </aside>

        {/* Main Editor Area â€” offset by sidebar width */}
        <main className="flex-1 flex flex-col overflow-hidden lg:ml-56">
          {/* Toolbar â€” sticky below navbar */}
          {!isEverythingView && (
            <>
              <div className="fixed top-16 left-0 right-0 lg:left-56 z-40 bg-card">
                <EditorToolbar
                  editor={editor}
                  onOpenCitationDialog={() => setIsCitationDialogOpen(true)}
                />
              </div>
              <div className="h-12 shrink-0" />
            </>
          )}

          <div className="relative flex flex-1 overflow-hidden">
            {(isImporting || isReformatting || isHydrating) && (
              <LoadingScreen fullscreen={false} />
            )}
            <button
              type="button"
              onClick={() => setIsInfoPanelOpen((prev) => !prev)}
              className="hidden xl:flex items-center justify-center absolute right-3 top-3 z-20 w-7 h-7 rounded-full border border-border bg-card/95 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={isInfoPanelOpen ? 'Hide document info' : 'Show document info'}
            >
              (i)
            </button>
            {/* Editor/References/Comments Container */}
            <div className="flex-1 overflow-auto">
              <div className="p-8 lg:p-12">
                {isEverythingView ? (
                  /* ============================== */
                  /* EVERYTHING VIEW                */
                  /* ============================== */
                  <motion.div
                    className="max-w-3xl mx-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="mb-8">
                      <h1 className="text-3xl font-extrabold text-foreground mb-2">
                        {manuscript.title}
                      </h1>
                      <p className="text-sm text-muted-foreground italic mb-3">Full Manuscript Preview</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent">
                          <FileText size={10} />
                          {totalWordCount.toLocaleString()} words
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent">
                          <Layers size={10} />
                          {manuscript.sections.length} sections
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent">
                          <MessageSquare size={10} />
                          {manuscript.comments.filter((c) => !c.resolved).length} unresolved comments
                        </span>
                      </div>
                    </div>

                    {/* Full manuscript */}
                    <div className="space-y-10">
                      {manuscript.sections.map((section) => {
                        const sectionCommentsAll = manuscript.comments.filter(
                          (c) => c.sectionId === section.id && !c.parentId
                        );

                        return (
                          <div key={section.id} className="pb-8 border-b border-border last:border-0">
                            <h2 className="text-2xl font-bold text-foreground mb-1">{section.title}</h2>
                            <p className="text-xs text-muted-foreground mb-4">
                              {countWords(section.content).toLocaleString()} words
                              {section.lastEditedBy && (
                                <> &middot; Last edited by {section.lastEditedBy}</>
                              )}
                            </p>

                            <div
                              className="prose prose-sm max-w-none text-foreground/80 leading-relaxed space-y-4 mb-6"
                              dangerouslySetInnerHTML={{ __html: section.content || '<p class="text-muted-foreground italic">No content yet.</p>' }}
                            />

                            {/* Comments for this section */}
                            {sectionCommentsAll.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <MessageSquare size={12} />
                                  Comments ({sectionCommentsAll.length})
                                </h4>
                                {sectionCommentsAll.map((comment) => {
                                  const replies = manuscript.comments.filter((c) => c.parentId === comment.id);
                                  return (
                                    <div
                                      key={comment.id}
                                      className={`border-l-2 rounded-r-lg p-3 text-sm ${
                                        comment.resolved
                                          ? 'border-status-completed/40 bg-status-completed/5 opacity-60'
                                          : 'border-status-pending bg-status-pending/5'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 mb-1 text-xs flex-wrap">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                          comment.resolved ? 'bg-status-completed/20 text-status-completed' : 'bg-status-pending/20 text-status-pending'
                                        }`}>
                                          {comment.userInitials}
                                        </div>
                                        <span className="font-medium text-foreground">{comment.userName}</span>
                                        <span className="text-muted-foreground">{format(comment.timestamp, 'MMM d, h:mm a')}</span>
                                        <span className="text-muted-foreground italic">â€” in &ldquo;{section.title}&rdquo;</span>
                                        {comment.resolved && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-status-completed/15 text-status-completed text-[10px] font-medium">
                                            <CheckCircle size={10} />
                                            Resolved
                                          </span>
                                        )}
                                      </div>
                                      {comment.quotedText && (
                                        <div className="mb-1.5 px-3 py-1 bg-journi-green/5 border-l-2 border-journi-green/40 rounded-r text-xs text-muted-foreground italic">
                                          &ldquo;{comment.quotedText}&rdquo;
                                        </div>
                                      )}
                                      <p className="text-foreground">{comment.content}</p>
                                      {replies.length > 0 && (
                                        <div className="ml-6 mt-2 space-y-1.5">
                                          {replies.map((reply) => (
                                            <div key={reply.id} className="text-xs text-muted-foreground">
                                              <span className="font-medium text-foreground">{reply.userName}:</span>{' '}
                                              {reply.content}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  /* ============================== */
                  /* NORMAL SECTION VIEW            */
                  /* ============================== */
                  <motion.div
                    className="max-w-3xl mx-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    {/* Section Header */}
                    <div className="mb-8">
                      <h1 className="text-3xl font-extrabold text-foreground mb-2">
                        {activeSection}
                      </h1>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {currentSection && (
                          <span>
                            Last edited by {currentSection.lastEditedBy} &middot;{' '}
                            {currentSection.lastEditedAt && format(currentSection.lastEditedAt, 'MMM d, yyyy \'at\' h:mm a')}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-muted-foreground">
                          <FileText size={10} />
                          {currentWordCount.toLocaleString()} words
                        </span>
                      </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-2 mb-6 border-b border-border">
                      <button
                        onClick={() => setActiveTab('editor')}
                        className={`px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/40 ${
                          activeTab === 'editor'
                            ? 'text-journi-green border-b-2 border-journi-green'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        onClick={() => setActiveTab('references')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/40 ${
                          activeTab === 'references'
                            ? 'text-journi-green border-b-2 border-journi-green'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <BookOpen size={16} />
                        References
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-journi-green/15 text-journi-green text-[10px] font-bold">
                          {manuscript.citations.length}
                        </span>
                      </button>
                      <button
                        onClick={() => setActiveTab('comments')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/40 ${
                          activeTab === 'comments'
                            ? 'text-journi-green border-b-2 border-journi-green'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <MessageSquare size={16} />
                        Comments
                        {unresolvedCommentsCount > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-status-delayed/15 text-status-delayed text-[10px] font-bold">
                            {unresolvedCommentsCount}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Content Area */}
                    {activeTab === 'editor' && (
                      <div
                        ref={editorContainerRef}
                        className="relative"
                        onContextMenu={handleEditorContextMenu}
                        onClick={() => setTableContextMenuPos(null)}
                      >
                        <EditorContent editor={editor} />

                        {/* Floating comment popup on text selection */}
                        {showCommentPopup && selectedText && (
                          <div
                            className="absolute z-30"
                            style={{ top: commentPopupPos.top, left: commentPopupPos.left, transform: 'translateX(-50%)' }}
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[280px]"
                            >
                              <div className="text-[10px] text-muted-foreground mb-1.5 italic truncate max-w-[260px]">
                                On: &ldquo;{selectedText.substring(0, 80)}{selectedText.length > 80 ? '...' : ''}&rdquo;
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  ref={inlineCommentInputRef}
                                  type="text"
                                  value={inlineCommentText}
                                  onChange={(e) => setInlineCommentText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleInlineComment();
                                    if (e.key === 'Escape') {
                                      setShowCommentPopup(false);
                                      setInlineCommentText('');
                                    }
                                  }}
                                  placeholder="Add comment on this text..."
                                  className="flex-1 bg-muted text-sm text-foreground placeholder:text-muted-foreground rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-journi-green"
                                  autoFocus
                                />
                                <button
                                  onClick={handleInlineComment}
                                  disabled={!inlineCommentText.trim()}
                                  className="p-1.5 rounded bg-journi-green text-white hover:bg-journi-green/90 disabled:opacity-40 transition-colors"
                                >
                                  <MessageSquarePlus size={14} />
                                </button>
                              </div>
                            </motion.div>
                          </div>
                        )}

                        {tableContextMenuPos && (
                          <div
                            className="absolute z-40 bg-card border border-border rounded-lg shadow-lg p-1.5 min-w-[170px]"
                            style={{ top: tableContextMenuPos.top, left: tableContextMenuPos.left }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="w-full text-left px-2.5 py-1.5 text-xs text-foreground hover:bg-accent rounded"
                              onClick={() => {
                                editor?.chain().focus().addRowAfter().run();
                                setTableContextMenuPos(null);
                              }}
                            >
                              Add Row
                            </button>
                            <button
                              className="w-full text-left px-2.5 py-1.5 text-xs text-foreground hover:bg-accent rounded"
                              onClick={() => {
                                editor?.chain().focus().addColumnAfter().run();
                                setTableContextMenuPos(null);
                              }}
                            >
                              Add Column
                            </button>
                            <button
                              className="w-full text-left px-2.5 py-1.5 text-xs text-foreground hover:bg-accent rounded"
                              onClick={handleResizeTable}
                            >
                              Resize Table...
                            </button>
                            <button
                              className="w-full text-left px-2.5 py-1.5 text-xs text-status-delayed hover:bg-status-delayed/10 rounded"
                              onClick={() => {
                                editor?.chain().focus().deleteTable().run();
                                setTableContextMenuPos(null);
                              }}
                            >
                              Delete Table
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'references' && (
                      <ReferencesSection
                        citations={manuscript.citations}
                        onRemoveCitation={removeCitation}
                        manuscriptId={manuscript.id}
                      />
                    )}

                    {activeTab === 'comments' && (
                      <CommentThread
                        comments={manuscript.comments}
                        sectionId={sectionId}
                        onAddComment={handleCommentSubmit}
                        onResolveComment={resolveComment}
                        onRemoveComment={removeComment}
                      />
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <aside
              className={`hidden xl:flex flex-col bg-card overflow-auto transition-[width,opacity,border] duration-200 ${
                isInfoPanelOpen
                  ? 'w-72 opacity-100 border-l border-border'
                  : 'w-0 opacity-0 border-l-0 pointer-events-none'
              }`}
            >
              <div className="p-4 border-b border-border flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Document Info</h3>
                {manuscript.type === 'literature_review' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-bold">
                    <BookMarked size={10} />
                    Lit Review
                  </span>
                )}
                {manuscript.type === 'grant_application' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                    <DollarSign size={10} />
                    Grant
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">

                {/* â”€â”€ Literature Review: Search Strategy Panel â”€â”€ */}
                {manuscript.type === 'literature_review' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Database size={11} />
                      Search Strategy
                    </h4>

                    {/* Databases */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Databases searched</p>
                      <div className="space-y-1">
                        {LIT_DATABASES.map((db) => (
                          <label key={db} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={litSearchDbs.includes(db)}
                              onChange={(e) =>
                                setLitSearchDbs(
                                  e.target.checked
                                    ? [...litSearchDbs, db]
                                    : litSearchDbs.filter((d) => d !== db)
                                )
                              }
                              className="w-3 h-3 accent-journi-green"
                            />
                            <span className="text-[11px] text-foreground group-hover:text-journi-green transition-colors">{db}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Date range */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1 font-medium">Date range searched</p>
                      <input
                        type="text"
                        value={litDateRange}
                        onChange={(e) => setLitDateRange(e.target.value)}
                        placeholder="e.g. Jan 2015 â€“ Dec 2024"
                        className="w-full text-xs bg-muted text-foreground placeholder:text-muted-foreground rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-journi-green"
                      />
                    </div>

                    {/* PRISMA flow counts */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">PRISMA study counts</p>
                      <div className="space-y-1.5">
                        {(['identified', 'screened', 'eligible', 'included'] as const).map((key) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground capitalize w-20 shrink-0">{key}</span>
                            <input
                              type="number"
                              min={0}
                              value={litPrisma[key] || ''}
                              onChange={(e) => setLitPrisma({ ...litPrisma, [key]: Number(e.target.value) })}
                              className="w-full text-xs bg-muted text-foreground rounded px-2 py-1 outline-none focus:ring-1 focus:ring-journi-green text-right"
                            />
                          </div>
                        ))}
                        {litPrisma.included > 0 && (
                          <div className="mt-1.5 p-2 rounded-lg bg-journi-green/5 border border-journi-green/20 text-center">
                            <span className="text-xs font-bold text-journi-green">{litPrisma.included}</span>
                            <span className="text-[10px] text-muted-foreground"> studies included</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border" />
                  </div>
                )}

                {/* â”€â”€ Grant Application: Budget & Limits Panel â”€â”€ */}
                {manuscript.type === 'grant_application' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={11} />
                      Grant Tools
                    </h4>

                    {/* Funding agency */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1 font-medium">Funding agency</p>
                      <input
                        type="text"
                        value={grantAgency}
                        onChange={(e) => setGrantAgency(e.target.value)}
                        placeholder="e.g. NIH, Wellcome Trust..."
                        className="w-full text-xs bg-muted text-foreground placeholder:text-muted-foreground rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-journi-green"
                      />
                    </div>

                    {/* Section word limits */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Section word limits</p>
                      <div className="space-y-2">
                        {manuscript.sections
                          .filter((s) => GRANT_SECTION_LIMITS[s.title] !== undefined)
                          .map((s) => {
                            const limit = GRANT_SECTION_LIMITS[s.title];
                            const used = sectionWordCounts[s.title] || 0;
                            const pct = Math.min((used / limit) * 100, 100);
                            const isOver = used > limit;
                            const isWarning = used > limit * 0.85;
                            return (
                              <div key={s.id}>
                                <div className="flex items-center justify-between text-[11px] mb-0.5">
                                  <span className="text-muted-foreground truncate mr-1">{s.title}</span>
                                  <span className={`font-medium tabular-nums shrink-0 ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-foreground'}`}>
                                    {used}/{limit}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-journi-green/60'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                {isOver && (
                                  <p className="text-[10px] text-red-500 flex items-center gap-0.5 mt-0.5">
                                    <AlertTriangle size={9} />
                                    {used - limit} words over limit
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Budget tracker */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Budget overview (USD)</p>
                      <div className="space-y-1.5">
                        {grantBudgetItems.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const updated = [...grantBudgetItems];
                                updated[i] = { ...updated[i], name: e.target.value };
                                setGrantBudgetItems(updated);
                              }}
                              className="flex-1 min-w-0 text-[11px] bg-muted text-foreground rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-journi-green"
                            />
                            <span className="text-[11px] text-muted-foreground shrink-0">$</span>
                            <input
                              type="number"
                              min={0}
                              value={item.amount || ''}
                              onChange={(e) => {
                                const updated = [...grantBudgetItems];
                                updated[i] = { ...updated[i], amount: Number(e.target.value) };
                                setGrantBudgetItems(updated);
                              }}
                              className="w-20 text-[11px] bg-muted text-foreground rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-journi-green text-right"
                            />
                            <button
                              onClick={() => setGrantBudgetItems(grantBudgetItems.filter((_, idx) => idx !== i))}
                              className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <Minus size={11} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setGrantBudgetItems([...grantBudgetItems, { name: 'New Item', amount: 0 }])}
                          className="w-full flex items-center justify-center gap-1 text-[11px] text-journi-green hover:bg-journi-green/5 rounded py-1 transition-colors"
                        >
                          <Plus size={11} />
                          Add Line
                        </button>
                      </div>
                      {grantBudgetItems.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">Total</span>
                          <span className="font-bold text-foreground">
                            ${grantBudgetItems.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border" />
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Words</span>
                    <span className="font-medium text-foreground">{totalWordCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Sections</span>
                    <span className="font-medium text-foreground">{manuscript.sections.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Citations</span>
                    <span className="font-medium text-foreground">{manuscript.citations.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Comments</span>
                    <span className="font-medium text-foreground">
                      {manuscript.comments.filter((c) => !c.resolved).length} unresolved
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="font-medium text-foreground">
                      {format(manuscript.updatedAt, 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                {/* Word Count Breakdown */}
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Word Count by Section
                  </h4>
                  <div className="space-y-2">
                    {manuscript.sections.map((section) => {
                      const wc = sectionWordCounts[section.title] || 0;
                      const pct = totalWordCount > 0 ? (wc / totalWordCount) * 100 : 0;
                      return (
                        <div key={section.id}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground truncate mr-2">{section.title}</span>
                            <span className="font-medium text-foreground tabular-nums">{wc}</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-journi-green/60 rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Collaborators */}
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Collaborators
                  </h4>
                  <div className="space-y-2">
                    {project.collaborators.map((collab) => (
                      <div key={collab.id} className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            collab.online
                              ? 'bg-journi-green/20 text-journi-green ring-2 ring-journi-green/30'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {collab.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {collab.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {(collab.role ?? 'contributor').replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>

      {pendingImportReview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45" onClick={() => setPendingImportReview(null)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Review {pendingImportReview.result.sourceFormat === 'docx' ? 'Word' : pendingImportReview.result.sourceFormat.toUpperCase()} import
                </h3>
                <p className="text-xs text-muted-foreground">
                  Confirm placement of extracted content before it is committed.
                </p>
              </div>
              <button
                onClick={() => setPendingImportReview(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close review"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid max-h-[72vh] grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
              <div className="overflow-y-auto border-r border-border p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Text blocks</h4>
                <div className="space-y-2">
                  {pendingImportReview.result.review.blocks.filter((block) => block.type !== 'reference').map((block) => (
                    <div key={block.id} className="rounded-lg border border-border bg-background p-2.5">
                      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{block.type}</span>
                        <span>Page {block.page}</span>
                        <span>{Math.round((block.confidence || 0) * 100)}%</span>
                      </div>
                      <p className="text-xs text-foreground">{block.text || '(empty)'}</p>
                      <select
                        value={pendingImportReview.blockAssignments[block.id] || 'Content'}
                        onChange={(e) =>
                          setPendingImportReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  blockAssignments: { ...prev.blockAssignments, [block.id]: e.target.value },
                                }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-journi-green/40"
                      >
                        {Array.from(new Set([...manuscript.sections.map((s) => s.title), 'Content', 'Abstract', 'Search Strategy', 'Results & Synthesis', 'Discussion', 'References'])).map((title) => (
                          <option key={`${block.id}-${title}`} value={title}>{title}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <h4 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">References</h4>
                <div className="space-y-2">
                  {pendingImportReview.result.review.blocks.filter((block) => block.type === 'reference').map((block) => (
                    <div key={block.id} className="rounded-lg border border-border bg-background p-2.5">
                      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>reference</span>
                        <span>Page {block.page}</span>
                        <span>{Math.round((block.confidence || 0) * 100)}%</span>
                      </div>
                      <p className="text-xs text-foreground">{block.text || '(empty)'}</p>
                      <select
                        value={pendingImportReview.blockAssignments[block.id] || 'References'}
                        onChange={(e) =>
                          setPendingImportReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  blockAssignments: { ...prev.blockAssignments, [block.id]: e.target.value },
                                }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-journi-green/40"
                      >
                        {Array.from(new Set([...manuscript.sections.map((s) => s.title), 'References', 'Discussion', 'Content'])).map((title) => (
                          <option key={`${block.id}-${title}`} value={title}>{title}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {pendingImportReview.result.review.blocks.filter((block) => block.type === 'reference').length === 0 && (
                    <p className="text-xs text-muted-foreground/70">No reference blocks detected.</p>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Figures & tables</h4>
                <div className="space-y-3">
                  {pendingImportReview.result.review.figures.map((figure) => (
                    <div key={figure.id} className="rounded-lg border border-border bg-background p-2.5">
                      <p className="text-xs font-medium text-foreground">{figure.caption || figure.id}</p>
                      <img src={figure.imageData} alt={figure.caption || figure.id} className="mt-2 h-24 w-full rounded border border-border object-contain bg-white" />
                      <select
                        value={pendingImportReview.figureAssignments[figure.id] || 'Results & Synthesis'}
                        onChange={(e) =>
                          setPendingImportReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  figureAssignments: { ...prev.figureAssignments, [figure.id]: e.target.value },
                                }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-journi-green/40"
                      >
                        {Array.from(new Set([...manuscript.sections.map((s) => s.title), 'Results & Synthesis', 'Discussion', 'References'])).map((title) => (
                          <option key={`${figure.id}-${title}`} value={title}>{title}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {pendingImportReview.result.review.tables.map((table) => (
                    <div key={table.id} className="rounded-lg border border-border bg-background p-2.5">
                      <p className="text-xs font-medium text-foreground">{table.caption || table.id}</p>
                      <div className="mt-2 max-h-28 overflow-auto rounded border border-border bg-white p-2 text-[11px] text-foreground" dangerouslySetInnerHTML={{ __html: table.html }} />
                      <select
                        value={pendingImportReview.tableAssignments[table.id] || 'Results & Synthesis'}
                        onChange={(e) =>
                          setPendingImportReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  tableAssignments: { ...prev.tableAssignments, [table.id]: e.target.value },
                                }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-journi-green/40"
                      >
                        {Array.from(new Set([...manuscript.sections.map((s) => s.title), 'Results & Synthesis', 'Discussion', 'References'])).map((title) => (
                          <option key={`${table.id}-${title}`} value={title}>{title}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button
                onClick={() => setPendingImportReview(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptImportReview}
                className="rounded-lg bg-journi-green px-4 py-2 text-sm font-semibold text-journi-slate hover:opacity-90"
              >
                Accept and import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf,.jpg,.jpeg,.png,.gif,.webp"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Citation Dialog */}
      <CitationDialog
        isOpen={isCitationDialogOpen}
        onClose={() => setIsCitationDialogOpen(false)}
        onSubmit={handleCitationSubmit}
      />

      {/* New Manuscript Wizard */}
      <NewManuscriptWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
        manuscriptTypeLabels={manuscriptTypeLabels}
      />

      {/* Submit to Journal Dialog */}
      <SubmitToJournalDialog
        isOpen={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        manuscriptTitle={manuscript.title}
        manuscriptId={manuscript.id}
      />

      {/* Reformat Panel */}
      <ReformatPanel
        isOpen={isReformatOpen}
        onClose={() => setIsReformatOpen(false)}
        manuscriptId={manuscript.id}
        onApplySafeAction={handleApplyFormatAction}
      />

      {/* Resize Table Dialog */}
      {resizeDialog?.open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[70] backdrop-blur-sm" onClick={() => setResizeDialog(null)} />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-foreground">Resize Table</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="resize-rows" className="block text-xs font-medium text-foreground mb-1">Rows</label>
                  <input
                    id="resize-rows"
                    type="number"
                    min="1"
                    value={resizeDialog.rows}
                    onChange={(e) => setResizeDialog({ ...resizeDialog, rows: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                  />
                </div>
                <div>
                  <label htmlFor="resize-cols" className="block text-xs font-medium text-foreground mb-1">Columns</label>
                  <input
                    id="resize-cols"
                    type="number"
                    min="1"
                    value={resizeDialog.cols}
                    onChange={(e) => setResizeDialog({ ...resizeDialog, cols: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setResizeDialog(null)} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-accent transition-colors">Cancel</button>
                <button onClick={applyResizeTable} className="flex-1 px-3 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">Apply</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rename Section Dialog */}
      {renamingSection && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[70] backdrop-blur-sm" onClick={() => setRenamingSection(null)} />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-foreground">Rename Subsection</h2>
              <div>
                <label htmlFor="rename-section-input" className="sr-only">Subsection name</label>
                <input
                  id="rename-section-input"
                  type="text"
                  value={renamingSection.value}
                  onChange={(e) => setRenamingSection({ ...renamingSection, value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyRenameSection(); } if (e.key === 'Escape') setRenamingSection(null); }}
                  autoFocus
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRenamingSection(null)} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-accent transition-colors">Cancel</button>
                <button onClick={applyRenameSection} className="flex-1 px-3 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">Rename</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
