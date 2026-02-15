/**
 * Editor Toolbar Component
 * Formatting controls for TipTap editor with image and table support
 */
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
  Table,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onOpenCitationDialog?: () => void;
}

export default function EditorToolbar({ editor, onOpenCitationDialog }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive = false,
    icon: Icon,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    icon: React.ElementType;
    title: string;
  }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        isActive
          ? 'bg-journi-green/15 text-journi-green'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
      title={title}
      type="button"
    >
      <Icon size={16} />
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-border mx-1" />;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="bg-card border-b border-border px-6 py-2.5 flex items-center gap-1 overflow-x-auto">
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

      {/* Image & Table */}
      <ToolbarButton
        onClick={insertImage}
        icon={ImagePlus}
        title="Insert Image"
      />
      <ToolbarButton
        onClick={insertTable}
        icon={Table}
        title="Insert Table (3x3)"
      />

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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-journi-green/10 hover:bg-journi-green/20 rounded-lg transition-colors"
          type="button"
        >
          <Quote size={14} />
          Add Citation
        </button>
      )}
    </div>
  );
}
