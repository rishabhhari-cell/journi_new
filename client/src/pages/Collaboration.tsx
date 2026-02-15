/**
 * Journi Collaboration Workspace — Fully Functional
 * TipTap editor with citations, comments, word count, editable title, images, and tables
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Video, CheckCircle, Circle, BookOpen, MessageSquare, Pencil, Check, FileText, Download, Upload, FileDown, Loader2 } from 'lucide-react';
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
import type { CitationFormData, CommentFormData, DocumentSection } from '@/types';
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

// Count words from HTML content by stripping tags
function countWords(html: string): number {
  if (!html || html === '<p></p>') return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

export default function Collaboration() {
  const {
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current section data
  const currentSection = getSectionByTitle(activeSection);
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
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
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
  }, [activeSection, sectionContent, editor]);

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
    setShowExportMenu(false);
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
    setShowExportMenu(false);
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

  // Import handler
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

      // Build full sections with required fields
      const newSections: DocumentSection[] = result.sections.map((s, i) => ({
        id: `imported-${Date.now()}-${i}`,
        title: s.title || `Section ${i + 1}`,
        content: s.content || '<p></p>',
        status: 'draft' as const,
        order: i,
        lastEditedBy: 'You',
        lastEditedAt: new Date(),
      }));

      if (newSections.length > 0) {
        updateTitle(result.title);
        replaceSections(newSections);
        setActiveSection(newSections[0].title);
        toast.success(`Imported "${result.title}" with ${newSections.length} section(s)`);
      } else {
        toast.error('No content found in the file');
      }
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Failed to import file. Please try a different file.');
    } finally {
      setIsImporting(false);
      // Reset file input so the same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Determine section status based on content and comments
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
    title: section.title,
    status: getSectionStatus(section.title),
  }));

  // Online team members
  const onlineMembers = project.collaborators.filter((c) => c.online);

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* Document Outline Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-card border-r border-border pt-6 pb-4 shrink-0">
          <div className="px-4 mb-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Document
            </h2>
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
            {/* Total word count */}
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <FileText size={10} />
              {totalWordCount.toLocaleString()} words total
            </p>
          </div>

          <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
            {documentSections.map((sec) => {
              const config = sectionStatusConfig[sec.status];
              const Icon = config.icon;
              const wc = sectionWordCounts[sec.title] || 0;
              return (
                <button
                  key={sec.title}
                  onClick={() => {
                    setActiveSection(sec.title);
                    setActiveTab('editor');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${
                      activeSection === sec.title
                        ? 'bg-journi-green/10 text-journi-green font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  <Icon size={14} className={config.color} />
                  <span className="flex-1 text-left truncate">{sec.title}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{wc}</span>
                </button>
              );
            })}
          </nav>

          {/* Team Online */}
          <div className="px-4 pt-4 border-t border-border">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
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

        {/* Main Editor Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <EditorToolbar
            editor={editor}
            onOpenCitationDialog={() => setIsCitationDialogOpen(true)}
          />

          <div className="flex flex-1 overflow-hidden">
            {/* Editor/References/Comments Container */}
            <div className="flex-1 overflow-auto">
              <div className="p-8 lg:p-12">
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
                          {format(currentSection.lastEditedAt, 'MMM d, yyyy \'at\' h:mm a')}
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
                    <div>
                      <EditorContent editor={editor} />
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
              </div>
            </div>

            {/* Activity Timeline Sidebar */}
            <aside className="hidden xl:flex flex-col w-72 bg-card border-l border-border overflow-auto">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Document Info</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Stats */}
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

                {/* Import / Export */}
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Import / Export
                  </h4>
                  <div className="space-y-2">
                    {/* Import */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground bg-accent hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {isImporting ? 'Importing...' : 'Import Document'}
                      <span className="ml-auto text-[10px] text-muted-foreground">.docx, .pdf</span>
                    </button>
                    {/* Export DOCX */}
                    <button
                      onClick={handleExportDocx}
                      disabled={isExporting !== null}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground bg-accent hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isExporting === 'docx' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                      {isExporting === 'docx' ? 'Exporting...' : 'Export as Word (.docx)'}
                    </button>
                    {/* Export PDF */}
                    <button
                      onClick={handleExportPdf}
                      disabled={isExporting !== null}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground bg-accent hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isExporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                      {isExporting === 'pdf' ? 'Exporting...' : 'Export as PDF'}
                    </button>
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
