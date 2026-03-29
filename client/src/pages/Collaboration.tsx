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
  Upload, FileDown, Loader2, MessageSquarePlus, Layers, Plus, Trash2,
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
import ProjectSwitcher from '@/components/ProjectSwitcher';
import NewManuscriptWizard from '@/components/collaboration/NewManuscriptWizard';
import type { WizardResult } from '@/components/collaboration/NewManuscriptWizard';
import EditorToolbar from '@/components/collaboration/EditorToolbar';
import CitationDialog from '@/components/collaboration/CitationDialog';
import ReferencesSection from '@/components/collaboration/ReferencesSection';
import CommentThread from '@/components/collaboration/CommentThread';
import SubmitToJournalDialog from '@/components/publication/SubmitToJournalDialog';
import ReformatPanel from '@/components/collaboration/ReformatPanel';
import { useManuscript } from '@/contexts/ManuscriptContext';
import type { CitationFormData, CommentFormData, DocumentSection, ManuscriptType } from '@/types';
import { format } from 'date-fns';
import { exportToDocx, exportToPdf, importDocx, importPdf, importImage } from '@/lib/document-io';
import { toast } from 'sonner';
import { countWordsFromHtml } from '@shared/word-count';
import { OUP_AI_REVIEW_SEED } from '@/data/seeded-ou-paper';
import '@/components/collaboration/editor-styles.css';

const sectionStatusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  complete: { color: 'text-status-completed', icon: CheckCircle },
  active: { color: 'text-status-progress', icon: Circle },
  draft: { color: 'text-status-pending', icon: Circle },
  pending: { color: 'text-muted-foreground', icon: Circle },
};

type ViewTab = 'editor' | 'references' | 'comments';

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

function normalizeImportedText(input: string): string {
  return input
    .replace(/â€™/g, '’')
    .replace(/â€˜/g, '‘')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€”/g, '—')
    .replace(/â€˜/g, '‘')
    .replace(/â€\u009d/g, '”')
    .replace(/â€\u009c/g, '“')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã±/g, 'ñ')
    .replace(/Å‘/g, 'ő')
    .replace(/Â/g, '');
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
  } = useManuscript();

  const project = { collaborators: [] as { id: string; name: string; initials: string; online: boolean; role?: string }[] };

const [isCitationDialogOpen, setIsCitationDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('editor');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(manuscript.title);
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('journi.editor.info-panel.open');
      return raw === null ? true : raw === '1';
    } catch {
      return true;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // OUP seed confirmation
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);

  // Literature review — search strategy tracker
  const [litSearchDbs, setLitSearchDbs] = useState<string[]>(['PubMed/MEDLINE']);
  const [litPrisma, setLitPrisma] = useState({ identified: 0, screened: 0, eligible: 0, included: 0 });
  const [litDateRange, setLitDateRange] = useState('');

  // Grant application — budget tracker + agency
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

  // "Everything" view
  const isEverythingView = activeSection === '__everything__';

  // Check if the manuscript is "empty" — no section has any actual prose.
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

  // Import handler — merges imported content into existing sections by matching titles
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let result: {
        title: string;
        sections: Partial<DocumentSection>[];
        citations: CitationFormData[];
        diagnostics: Array<{ level: 'info' | 'warning' | 'error'; code: string; message: string }>;
        totalWordCount: number;
      };

      if (ext === 'docx') {
        result = await importDocx(file);
      } else if (ext === 'pdf') {
        result = await importPdf(file);
      } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') {
        result = await importImage(file);
      } else {
        toast.error('Unsupported file type. Please use .docx, .pdf, or an image file.');
        return;
      }

      if (!result.sections.length) {
        toast.error('No content found in the file');
        return;
      }

      if (result.title?.trim()) {
        updateTitle(result.title.trim());
      }

      if (result.citations.length > 0) {
        addCitations(
          result.citations.map((citation) => ({
            ...citation,
            title: normalizeImportedText(citation.title),
            journal: citation.journal ? normalizeImportedText(citation.journal) : undefined,
          })),
        );
      }

      // Merge imported sections into existing sections by matching titles (case-insensitive)
      const existingSections = [...manuscript.sections];
      let matchedCount = 0;
      let addedCount = 0;
      const unmatchedImported: Partial<DocumentSection>[] = [];

      for (const imported of result.sections) {
        const importedTitle = (imported.title || '').trim().toLowerCase();
        const match = existingSections.find(
          (s) => s.title.trim().toLowerCase() === importedTitle
        );

        if (match) {
          updateSectionContent(match.id, normalizeImportedText(imported.content || '<p></p>'));
          matchedCount++;
        } else {
          const genericTitles = ['content', 'untitled section'];
          const isGeneric = genericTitles.includes(importedTitle);

          if (isGeneric && result.sections.length === 1) {
            const activeS = getSectionByTitle(activeSection);
            if (activeS) {
              updateSectionContent(activeS.id, normalizeImportedText(imported.content || '<p></p>'));
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
            title: s.title || `Imported Section ${i + 1}`,
            content: normalizeImportedText(s.content || '<p></p>'),
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

      const warnings = result.diagnostics.filter((d) => d.level !== 'info');
      if (warnings.length > 0) {
        toast.warning(warnings[0].message);
      }

      if (matchedCount > 0) {
        const firstMatchTitle = result.sections.find((s) =>
          existingSections.some((es) => es.title.trim().toLowerCase() === (s.title || '').trim().toLowerCase())
        )?.title;
        if (firstMatchTitle) {
          const matched = existingSections.find(
            (es) => es.title.trim().toLowerCase() === firstMatchTitle.trim().toLowerCase()
          );
          if (matched) setActiveSection(matched.title);
        }
      } else if (unmatchedImported.length > 0) {
        setActiveSection(unmatchedImported[0].title || 'Content');
      }
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Failed to import file. Please try a different file.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSeedOupPaper = () => {
    setSeedConfirmOpen(true);
  };

  const handleReformatAccept = (
    acceptedSectionId: string,
    _newHtml: string,
    _currentHtml: string,
    originalText: string,
    suggestedText: string,
  ) => {
    const section = manuscript.sections.find((s) => s.id === acceptedSectionId);
    if (!section) return;
    const newHtml = section.content.replace(originalText, suggestedText);
    updateSectionContent(acceptedSectionId, newHtml);
  };

  const handleConfirmSeedImport = () => {
    const seedSections = OUP_AI_REVIEW_SEED.sections;
    const existingSections = [...manuscript.sections].sort((a, b) => a.order - b.order);
    const timestamp = Date.now();

    const updated = existingSections.map((section, index) => {
      if (index >= seedSections.length) return { ...section, order: index };
      const seed = seedSections[index];
      return {
        ...section,
        title: seed.title,
        content: normalizeImportedText(seed.content),
        status: 'draft' as const,
        lastEditedBy: 'Seed Import',
        lastEditedAt: new Date(),
        order: index,
      };
    });

    if (seedSections.length > existingSections.length) {
      for (let i = existingSections.length; i < seedSections.length; i++) {
        const seed = seedSections[i];
        updated.push({
          id: `seeded-${timestamp}-${i}`,
          title: seed.title,
          content: normalizeImportedText(seed.content),
          status: 'draft',
          lastEditedBy: 'Seed Import',
          lastEditedAt: new Date(),
          order: i,
        });
      }
    }

    updateTitle(OUP_AI_REVIEW_SEED.manuscriptTitle);
    replaceSections(updated);
    addCitations(
      OUP_AI_REVIEW_SEED.citations.map((citation) => ({
        ...citation,
        title: normalizeImportedText(citation.title),
        journal: citation.journal ? normalizeImportedText(citation.journal) : undefined,
      })),
    );
    setActiveSection('Title');
    setActiveTab('editor');
    setSeedConfirmOpen(false);
    toast.success(`Loaded seeded OUP paper (${OUP_AI_REVIEW_SEED.citations.length} references)`);
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
      // Create the manuscript first, then import the file into it
      createManuscript(result.title, result.type);
      // Trigger file import via a synthetic event
      const dt = new DataTransfer();
      dt.items.add(result.file);
      const fakeEvent = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      await handleImportFile(fakeEvent);
      toast.success('Document imported!');
    } else {
      createManuscript(result.title, result.type);
      toast.success('New document created — start writing!');
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
  // Zero manuscripts — "Get Started" screen
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
        {/* Document Outline Sidebar — fixed */}
        <aside className="hidden lg:flex flex-col w-56 bg-card border-r border-border pt-4 pb-4 shrink-0 fixed top-16 bottom-0 z-30">
          {/* Project Switcher */}
          <div className="px-3 mb-2">
            <ProjectSwitcher variant="compact" />
          </div>

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

                {/* New document button — opens wizard */}
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
                {litPrisma.included} studies included · {litSearchDbs.length} databases
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
              <button
                onClick={handleSeedOupPaper}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-foreground bg-accent hover:bg-accent/80 rounded-md transition-colors"
                title="Load seeded OUP AI paper"
              >
                <Upload size={12} />
                OUP Seed
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

        {/* Main Editor Area — offset by sidebar width */}
        <main className="flex-1 flex flex-col overflow-hidden lg:ml-56">
          {/* Toolbar — sticky below navbar */}
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
                                        <span className="text-muted-foreground italic">— in &ldquo;{section.title}&rdquo;</span>
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
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          activeTab === 'editor'
                            ? 'text-journi-green border-b-2 border-journi-green'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        onClick={() => setActiveTab('references')}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
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
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
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

                {/* ── Literature Review: Search Strategy Panel ── */}
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
                        placeholder="e.g. Jan 2015 – Dec 2024"
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

                {/* ── Grant Application: Budget & Limits Panel ── */}
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
        onAcceptChange={handleReformatAccept}
      />

      {/* OUP Seed import confirmation */}
      {seedConfirmOpen && (() => {
        const totalWords = OUP_AI_REVIEW_SEED.sections.reduce(
          (sum, s) => sum + countWords(s.content), 0
        );
        return (
          <>
            <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSeedConfirmOpen(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-journi-green/15 flex items-center justify-center">
                      <Upload size={18} className="text-journi-green" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">Import Demo Paper</h2>
                      <p className="text-xs text-muted-foreground">Review details before loading</p>
                    </div>
                  </div>
                  <button onClick={() => setSeedConfirmOpen(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="rounded-xl bg-muted/50 border border-border divide-y divide-border overflow-hidden">
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Paper Title</p>
                      <p className="text-sm font-medium text-foreground leading-snug">{OUP_AI_REVIEW_SEED.paperTitle}</p>
                    </div>
                    <div className="px-4 py-3 flex gap-6">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Type</p>
                        <p className="text-sm font-medium text-foreground">Literature Review</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sections</p>
                        <p className="text-sm font-medium text-foreground">{OUP_AI_REVIEW_SEED.sections.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Word Count</p>
                        <p className="text-sm font-medium text-foreground">{totalWords.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">References</p>
                        <p className="text-sm font-medium text-foreground">{OUP_AI_REVIEW_SEED.citations.length}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will replace your current editor content with the demo paper. Your existing work will be overwritten.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSeedConfirmOpen(false)}
                      className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmSeedImport}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-journi-green text-journi-slate rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Upload size={14} />
                      Confirm Import
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

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
