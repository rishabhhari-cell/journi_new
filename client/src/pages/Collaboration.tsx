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
  FilePlus2, FileUp, ChevronDown,
} from 'lucide-react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { EditorContent } from '@tiptap/react';
import Navbar from '@/components/Navbar';
import EditorToolbar from '@/components/collaboration/EditorToolbar';
import CitationDialog from '@/components/collaboration/CitationDialog';
import ReferencesSection from '@/components/collaboration/ReferencesSection';
import CommentThread from '@/components/collaboration/CommentThread';
import { useManuscript } from '@/contexts/ManuscriptContext';
import { useProject } from '@/contexts/ProjectContext';
import type { CitationFormData, CommentFormData, DocumentSection, ManuscriptType } from '@/types';
import { format } from 'date-fns';
import { exportToDocx, exportToPdf, importDocx, importPdf } from '@/lib/document-io';
import { toast } from 'sonner';
import '@/components/collaboration/editor-styles.css';

const sectionStatusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  complete: { color: 'text-status-completed', icon: CheckCircle },
  active: { color: 'text-status-progress', icon: Circle },
  draft: { color: 'text-status-pending', icon: Circle },
  pending: { color: 'text-muted-foreground', icon: Circle },
};

type ViewTab = 'editor' | 'references' | 'comments';

function countWords(html: string): number {
  if (!html || html === '<p></p>') return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  return words.length;
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
    removeCitation,
    addComment,
    removeComment,
    resolveComment,
    getSectionByTitle,
    replaceSections,
  } = useManuscript();

  const { project } = useProject();

  const [isCitationDialogOpen, setIsCitationDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('editor');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(manuscript.title);
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | null>(null);
  const [isImporting, setIsImporting] = useState(false);
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

  // Sync title draft when manuscript changes
  useEffect(() => {
    setTitleDraft(manuscript.title);
  }, [manuscript.title, activeManuscriptId]);

  // "Everything" view
  const isEverythingView = activeSection === '__everything__';

  // Check if the manuscript is "empty" (all sections have no real content)
  const isManuscriptEmpty = useMemo(() => {
    return manuscript.sections.every(
      (s) => !s.content || s.content === '<p></p>' || s.content.trim() === ''
    );
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

    const rowsInput = window.prompt('Number of rows:', String(currentSize.rows));
    if (rowsInput === null) return;

    const colsInput = window.prompt('Number of columns:', String(currentSize.cols));
    if (colsInput === null) return;

    const nextRows = Number.parseInt(rowsInput, 10);
    const nextCols = Number.parseInt(colsInput, 10);

    if (!Number.isInteger(nextRows) || !Number.isInteger(nextCols) || nextRows < 1 || nextCols < 1) {
      window.alert('Please enter valid positive integers for rows and columns.');
      return;
    }

    if (nextRows > currentSize.rows) {
      for (let i = 0; i < nextRows - currentSize.rows; i += 1) {
        editor.chain().focus().addRowAfter().run();
      }
    } else if (nextRows < currentSize.rows) {
      for (let i = 0; i < currentSize.rows - nextRows; i += 1) {
        editor.chain().focus().deleteRow().run();
      }
    }

    if (nextCols > currentSize.cols) {
      for (let i = 0; i < nextCols - currentSize.cols; i += 1) {
        editor.chain().focus().addColumnAfter().run();
      }
    } else if (nextCols < currentSize.cols) {
      for (let i = 0; i < currentSize.cols - nextCols; i += 1) {
        editor.chain().focus().deleteColumn().run();
      }
    }

    setTableContextMenuPos(null);
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
      let result: { title: string; sections: Partial<DocumentSection>[] };

      if (ext === 'docx') {
        result = await importDocx(file);
      } else if (ext === 'pdf') {
        result = await importPdf(file);
      } else {
        toast.error('Unsupported file type. Please use .docx or .pdf files.');
        return;
      }

      if (!result.sections.length) {
        toast.error('No content found in the file');
        return;
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
          updateSectionContent(match.id, imported.content || '<p></p>');
          matchedCount++;
        } else {
          const genericTitles = ['content', 'untitled section'];
          const isGeneric = genericTitles.includes(importedTitle);

          if (isGeneric && result.sections.length === 1) {
            const activeS = getSectionByTitle(activeSection);
            if (activeS) {
              updateSectionContent(activeS.id, imported.content || '<p></p>');
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
            content: s.content || '<p></p>',
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
      toast.success(`Imported: ${parts.join(', ')}`);

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

  // Delete document
  const handleDeleteDocument = (id: string) => {
    if (manuscripts.length <= 1) {
      toast.error('Cannot delete the only document');
      return;
    }
    if (window.confirm('Delete this document? This cannot be undone.')) {
      deleteManuscript(id);
      toast.success('Document deleted');
    }
  };

  // Rename section (subsection) from left sidebar
  const handleRenameSection = (sectionId: string) => {
    const section = manuscript.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const nextTitleInput = window.prompt('Rename subsection:', section.title);
    if (nextTitleInput === null) return;

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
      return;
    }

    const updatedSections = manuscript.sections.map((s) =>
      s.id === sectionId ? { ...s, title: nextTitle } : s
    );
    replaceSections(updatedSections);

    if (activeSection === section.title) {
      setActiveSection(nextTitle);
    }

    toast.success('Subsection renamed');
  };

  // Delete section (subsection) from left sidebar
  const handleDeleteSection = (sectionId: string) => {
    if (manuscript.sections.length <= 1) {
      toast.error('Cannot delete the only subsection');
      return;
    }

    const section = manuscript.sections.find((s) => s.id === sectionId);
    if (!section) return;

    if (!window.confirm(`Delete subsection "${section.title}"? This cannot be undone.`)) {
      return;
    }

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
                {/* Import existing work */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-medium text-foreground bg-accent hover:bg-accent/80 rounded-xl transition-colors disabled:opacity-50 border border-border"
                >
                  {isImporting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FileUp size={18} />
                  )}
                  {isImporting
                    ? 'Importing...'
                    : 'Already started? Import your paper (.docx or .pdf)'}
                </button>

                {/* Start fresh */}
                <button
                  onClick={() => {
                    const firstSection = manuscript.sections[0];
                    if (firstSection) {
                      updateSectionContent(firstSection.id, '<p></p><p></p>');
                      setActiveSection(firstSection.title);
                      setActiveTab('editor');
                    }
                    toast.success('Document ready — start writing!');
                  }}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 text-sm font-medium text-white bg-journi-green hover:bg-journi-green/90 rounded-xl transition-colors"
                >
                  <FilePlus2 size={18} />
                  Start writing a new paper
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
          accept=".docx,.pdf"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>
    );
  }

  // ========================================
  // Main editor view
  // ========================================
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* Document Outline Sidebar — fixed */}
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
                      {manuscripts.length > 1 && m.id !== activeManuscriptId && (
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
                      )}
                    </div>
                  ))}
                </div>

                {/* New document form */}
                {showNewDocForm ? (
                  <div className="p-2.5 border-t border-border space-y-2">
                    <input
                      type="text"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateDocument();
                        if (e.key === 'Escape') setShowNewDocForm(false);
                      }}
                      placeholder="Document title..."
                      className="w-full text-xs bg-muted text-foreground placeholder:text-muted-foreground rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-journi-green"
                      autoFocus
                    />
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value as ManuscriptType)}
                      className="w-full text-xs bg-muted text-foreground rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-journi-green"
                    >
                      {(Object.entries(manuscriptTypeLabels) as [ManuscriptType, string][]).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCreateDocument}
                        className="flex-1 text-[10px] font-medium text-white bg-journi-green hover:bg-journi-green/90 rounded px-2 py-1.5 transition-colors"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => setShowNewDocForm(false)}
                        className="flex-1 text-[10px] font-medium text-muted-foreground bg-accent hover:bg-accent/80 rounded px-2 py-1.5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewDocForm(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-journi-green hover:bg-journi-green/5 transition-colors border-t border-border"
                  >
                    <Plus size={12} />
                    New Document
                  </button>
                )}
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
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <FileText size={10} />
              {totalWordCount.toLocaleString()} words total
            </p>
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
                    <span className="text-[10px] text-muted-foreground tabular-nums">{wc}</span>
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

          {/* Export */}
          <div className="px-3 pt-3 border-t border-border space-y-1.5">
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

          {/* Team Online */}
          <div className="px-4 pt-3 border-t border-border">
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

          <div className="flex flex-1 overflow-hidden">
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
            <aside className="hidden xl:flex flex-col w-72 bg-card border-l border-border overflow-auto">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Document Info</h3>
              </div>
              <div className="p-4 space-y-4">
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
                          <p className="text-[10px] text-muted-foreground">{collab.role.replace('_', ' ')}</p>
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
        accept=".docx,.pdf"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Citation Dialog */}
      <CitationDialog
        isOpen={isCitationDialogOpen}
        onClose={() => setIsCitationDialogOpen(false)}
        onSubmit={handleCitationSubmit}
      />
    </div>
  );
}
