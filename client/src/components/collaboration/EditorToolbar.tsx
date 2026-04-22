/**
 * Editor Toolbar Component
 * Formatting controls for TipTap editor with image upload and table support
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Quote,
  Code,
  Undo,
  Redo,
  ImagePlus,
  Upload,
  Table,
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onOpenCitationDialog?: () => void;
}

const GRID_SIZE = 9;

export default function EditorToolbar({ editor, onOpenCitationDialog }: EditorToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const tableGridRef = useRef<HTMLDivElement>(null);
  const [linkInput, setLinkInput] = useState<{ show: boolean; value: string }>({ show: false, value: '' });
  const [imageUrlInput, setImageUrlInput] = useState<{ show: boolean; value: string }>({ show: false, value: '' });
  const linkInputRef = useRef<HTMLInputElement>(null);
  const imageUrlInputRef = useRef<HTMLInputElement>(null);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive = false,
    icon: Icon,
    title,
    destructive = false,
  }: {
    onClick: () => void;
    isActive?: boolean;
    icon: React.ElementType;
    title: string;
    destructive?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`p-2.5 sm:p-2 rounded transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center ${
        isActive
          ? 'bg-journi-green/15 text-journi-green'
          : destructive
            ? 'text-muted-foreground hover:text-status-delayed hover:bg-status-delayed/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
      aria-label={title}
      type="button"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-border mx-0.5 sm:mx-1 shrink-0" />;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href ?? '';
    setLinkInput({ show: true, value: previousUrl });
    setTimeout(() => linkInputRef.current?.focus(), 50);
  };

  const confirmLink = () => {
    const url = linkInput.value.trim();
    setLinkInput({ show: false, value: '' });
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const insertImageUrl = () => {
    setImageUrlInput({ show: true, value: '' });
    setTimeout(() => imageUrlInputRef.current?.focus(), 50);
  };

  const confirmImageUrl = () => {
    const url = imageUrlInput.value.trim();
    setImageUrlInput({ show: false, value: '' });
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editor.chain().focus().setImage({ src: dataUrl }).run();
    };
    reader.readAsDataURL(file);

    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const insertTable = useCallback((rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTableGrid(false);
    setHoveredCell(null);
  }, [editor]);

  // Close grid on click outside
  useEffect(() => {
    if (!showTableGrid) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (tableGridRef.current && !tableGridRef.current.contains(e.target as Node)) {
        setShowTableGrid(false);
        setHoveredCell(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTableGrid]);

  const isInTable = editor.isActive('table');

  return (
    <div className="bg-card border-b border-border">
    {/* Inline link URL input */}
    {linkInput.show && (
      <div className="flex items-center gap-2 px-3 sm:px-6 py-2 border-b border-border bg-accent/30">
        <label htmlFor="toolbar-link-url" className="text-xs text-muted-foreground shrink-0 hidden sm:block">Link URL:</label>
        <input
          id="toolbar-link-url"
          ref={linkInputRef}
          type="url"
          value={linkInput.value}
          onChange={(e) => setLinkInput({ ...linkInput, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmLink(); } if (e.key === 'Escape') setLinkInput({ show: false, value: '' }); }}
          placeholder="https://example.com"
          className="flex-1 px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-journi-green min-w-0"
        />
        <button type="button" onClick={confirmLink} className="px-3 py-1.5 text-xs font-semibold bg-journi-green text-journi-slate rounded hover:opacity-90 shrink-0">Apply</button>
        <button type="button" onClick={() => setLinkInput({ show: false, value: '' })} aria-label="Cancel link" className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">Cancel</button>
      </div>
    )}
    {/* Inline image URL input */}
    {imageUrlInput.show && (
      <div className="flex items-center gap-2 px-3 sm:px-6 py-2 border-b border-border bg-accent/30">
        <label htmlFor="toolbar-image-url" className="text-xs text-muted-foreground shrink-0 hidden sm:block">Image URL:</label>
        <input
          id="toolbar-image-url"
          ref={imageUrlInputRef}
          type="url"
          value={imageUrlInput.value}
          onChange={(e) => setImageUrlInput({ ...imageUrlInput, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmImageUrl(); } if (e.key === 'Escape') setImageUrlInput({ show: false, value: '' }); }}
          placeholder="https://example.com/image.png"
          className="flex-1 px-2 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-journi-green min-w-0"
        />
        <button type="button" onClick={confirmImageUrl} className="px-3 py-1.5 text-xs font-semibold bg-journi-green text-journi-slate rounded hover:opacity-90 shrink-0">Insert</button>
        <button type="button" onClick={() => setImageUrlInput({ show: false, value: '' })} aria-label="Cancel image URL" className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">Cancel</button>
      </div>
    )}
    <div className="px-2 sm:px-6 py-2 flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        icon={Bold}
        title="Bold (Ctrl+B)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        icon={Italic}
        title="Italic (Ctrl+I)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        icon={Underline}
        title="Underline (Ctrl+U)"
      />

      <Divider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        icon={Heading1}
        title="Heading 1"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        icon={Heading2}
        title="Heading 2"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        icon={Heading3}
        title="Heading 3"
      />

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        icon={List}
        title="Bullet List"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        icon={ListOrdered}
        title="Numbered List"
      />

      <Divider />

      {/* Link, Blockquote, Code */}
      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive('link')}
        icon={Link2}
        title="Insert Link"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        icon={Quote}
        title="Blockquote"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        icon={Code}
        title="Inline Code"
      />

      <Divider />

      {/* Image — URL + Local Upload */}
      <ToolbarButton
        onClick={insertImageUrl}
        icon={ImagePlus}
        title="Insert Image from URL"
      />
      <ToolbarButton
        onClick={() => imageInputRef.current?.click()}
        icon={Upload}
        title="Upload Image from Device"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLocalImageUpload}
      />

      <Divider />

      {/* Table */}
      <div className="relative" ref={tableGridRef}>
        <ToolbarButton
          onClick={() => setShowTableGrid((v) => !v)}
          isActive={showTableGrid}
          icon={Table}
          title="Insert Table"
        />
        {showTableGrid && (
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg p-3 z-50 max-w-[min(220px,90vw)]">
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
            >
              {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
                const row = Math.floor(i / GRID_SIZE) + 1;
                const col = (i % GRID_SIZE) + 1;
                const isHighlighted =
                  hoveredCell !== null && row <= hoveredCell.row && col <= hoveredCell.col;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`w-[18px] h-[18px] rounded-[2px] border transition-colors ${
                      isHighlighted
                        ? 'bg-journi-green/30 border-journi-green/60'
                        : 'bg-muted/40 border-border hover:border-muted-foreground/30'
                    }`}
                    onMouseEnter={() => setHoveredCell({ row, col })}
                    onClick={() => insertTable(row, col)}
                  />
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2 tabular-nums">
              {hoveredCell ? `${hoveredCell.row} × ${hoveredCell.col}` : 'Select size'}
            </p>
          </div>
        )}
      </div>
      {isInTable && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            icon={Rows3}
            title="Add Row"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            icon={Columns3}
            title="Add Column"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            icon={Trash2}
            title="Delete Table"
            destructive
          />
        </>
      )}

      <Divider />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        icon={Undo}
        title="Undo (Ctrl+Z)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        icon={Redo}
        title="Redo (Ctrl+Shift+Z)"
      />

      <div className="flex-1" />

      {/* Citation Button */}
      {onOpenCitationDialog && (
        <button
          onClick={onOpenCitationDialog}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground bg-journi-green/10 hover:bg-journi-green/20 rounded-lg transition-colors shrink-0"
          type="button"
        >
          <Quote size={14} />
          <span className="hidden sm:inline">Add Citation</span>
        </button>
      )}
    </div>
    </div>
  );
}
