/**
 * FormatPreview — Splitscreen manuscript formatting view
 * Left: Original manuscript (read-only)
 * Right: Reformatted version (editable TipTap) matching journal requirements
 */
import { useState, useMemo, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import Navbar from '@/components/Navbar';
import { useManuscript } from '@/contexts/ManuscriptContext';
import { useJournals } from '@/contexts/JournalsContext';
import { formatManuscriptForJournal } from '@/lib/format-manuscript';
import { ArrowLeft, Check, X, AlertTriangle, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DocumentSection } from '@/types';
import '@/components/collaboration/editor-styles.css';

// ============================================================================
// Editable section editor (right panel)
// ============================================================================

function FormattedSectionEditor({
  section,
  onUpdate,
}: {
  section: DocumentSection;
  onUpdate: (content: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false }),
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
      Image.configure({ HTMLAttributes: { class: 'rounded-lg max-w-full' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: section.content,
    editable: true,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none text-foreground/80 leading-relaxed space-y-4 focus:outline-none min-h-[300px]',
      },
    },
    onUpdate: ({ editor: ed }) => onUpdate(ed.getHTML()),
  });

  // Sync content when section changes
  useEffect(() => {
    if (editor && section.content !== editor.getHTML()) {
      editor.commands.setContent(section.content);
    }
  }, [section.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) {
    return <p className="text-sm text-muted-foreground">Loading editor...</p>;
  }

  return <EditorContent editor={editor} />;
}

// ============================================================================
// Main FormatPreview page
// ============================================================================

export default function FormatPreview() {
  const [matched, params] = useRoute('/format/:journalId');
  const [, navigate] = useLocation();
  const { manuscript, replaceSections } = useManuscript();
  const { getJournalById } = useJournals();

  const journalId = params?.journalId;
  const journal = journalId ? getJournalById(journalId) : undefined;

  // Generate formatted manuscript
  const formattedManuscript = useMemo(() => {
    if (!journal) return null;
    return formatManuscriptForJournal(manuscript, journal);
  }, [manuscript, journal]);

  const [editedSections, setEditedSections] = useState<DocumentSection[]>([]);
  const [activeOriginalSection, setActiveOriginalSection] = useState(0);
  const [activeFormattedSection, setActiveFormattedSection] = useState(0);

  // Initialize edited sections from formatted manuscript
  useEffect(() => {
    if (formattedManuscript) {
      setEditedSections(formattedManuscript.sections);
    }
  }, [formattedManuscript]);

  if (!matched || !journal || !formattedManuscript) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground mb-2">Journal not found</p>
            <button
              onClick={() => navigate('/discovery')}
              className="text-sm text-journi-green hover:underline"
            >
              Back to Discovery
            </button>
          </div>
        </div>
      </div>
    );
  }

  const requirements = journal.formattingRequirements;

  const handleAccept = () => {
    replaceSections(editedSections);
    navigate('/collaboration');
  };

  const handleCancel = () => {
    navigate('/discovery');
  };

  const updateEditedSection = (index: number, content: string) => {
    setEditedSections((prev) =>
      prev.map((s, idx) =>
        idx === index ? { ...s, content, status: s.status === 'pending' ? 'draft' : s.status } : s
      )
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Navbar />

      {/* Top bar with journal info and actions */}
      <div className="pt-16 bg-card border-b border-border">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Formatting for: {journal.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {requirements?.referenceStyle?.toUpperCase() || 'Standard'} style
                {requirements?.abstractStructure === 'structured' ? ' · Structured Abstract' : ''}
                {requirements?.wordLimits?.total
                  ? ` · ${requirements.wordLimits.total.toLocaleString()} word limit`
                  : ''}
                {requirements?.requiresKeywords ? ` · Keywords required` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
            >
              <X size={14} />
              Cancel
            </button>
            <button
              onClick={handleAccept}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-journi-green rounded-lg hover:opacity-90 transition-opacity"
            >
              <Check size={14} />
              Accept Formatting
            </button>
          </div>
        </div>
      </div>

      {/* Splitscreen panels */}
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        <ResizablePanelGroup direction="horizontal">
          {/* Left panel: Original manuscript (read-only) */}
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="h-full flex flex-col">
              <div className="bg-card border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Original Manuscript
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  {manuscript.sections.length} sections
                </span>
              </div>

              {/* Section tabs */}
              <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-border bg-card shrink-0">
                {manuscript.sections.map((section, idx) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveOriginalSection(idx)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                      activeOriginalSection === idx
                        ? 'bg-journi-green/10 text-journi-green'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>

              {/* Read-only content */}
              <div className="flex-1 overflow-auto p-6">
                <motion.div
                  key={activeOriginalSection}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    {manuscript.sections[activeOriginalSection]?.title}
                  </h2>
                  <div
                    className="prose prose-sm max-w-none text-foreground/80 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: manuscript.sections[activeOriginalSection]?.content || '',
                    }}
                  />
                </motion.div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: Formatted manuscript (editable) */}
          <ResizablePanel defaultSize={50} minSize={25}>
            <div className="h-full flex flex-col">
              <div className="bg-card border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck size={12} className="text-journi-green" />
                  Formatted for {journal.name}
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  {editedSections.length} sections · Editable
                </span>
              </div>

              {/* Section tabs for formatted version */}
              <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-border bg-card shrink-0">
                {editedSections.map((section, idx) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveFormattedSection(idx)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                      activeFormattedSection === idx
                        ? 'bg-journi-green/10 text-journi-green'
                        : section.status === 'pending'
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {section.title}
                    {section.status === 'pending' && (
                      <AlertTriangle size={10} className="text-amber-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Editable content */}
              <div className="flex-1 overflow-auto p-6">
                <motion.div
                  key={editedSections[activeFormattedSection]?.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    {editedSections[activeFormattedSection]?.title}
                    {editedSections[activeFormattedSection]?.status === 'pending' && (
                      <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        New section — needs content
                      </span>
                    )}
                  </h2>
                  {editedSections[activeFormattedSection] && (
                    <FormattedSectionEditor
                      key={editedSections[activeFormattedSection].id}
                      section={editedSections[activeFormattedSection]}
                      onUpdate={(content) =>
                        updateEditedSection(activeFormattedSection, content)
                      }
                    />
                  )}
                </motion.div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
