/**
 * TipTap Rich Text Editor
 * Full-featured editor with auto-save functionality
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import { useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import './editor-styles.css';

interface TipTapEditorProps {
  content: string;
  onUpdate: (content: string) => void;
  editable?: boolean;
}

export default function TipTapEditor({ content, onUpdate, editable = true }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // We'll use our custom Heading extension
        bulletList: false, // We'll use our custom BulletList extension
        orderedList: false, // We'll use our custom OrderedList extension
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-journi-green hover:underline cursor-pointer',
        },
      }),
      Underline,
      Color,
      TextStyle,
      BulletList.configure({
        HTMLAttributes: {
          class: 'list-disc list-outside ml-6',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'list-decimal list-outside ml-6',
        },
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none text-foreground/80 leading-relaxed space-y-4 focus:outline-none min-h-[500px] p-8',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      handleContentChange(html);
    },
  });

  // Debounce content changes for auto-save (1 second delay)
  const debouncedContent = useDebounce(content, 1000);

  const handleContentChange = (newContent: string) => {
    if (newContent !== content) {
      onUpdate(newContent);
    }
  };

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="text-sm text-muted-foreground p-8">Loading editor...</div>;
  }

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {editable && (
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/60">
          Auto-saving...
        </div>
      )}
    </div>
  );
}

// Export the editor instance hook for toolbar integration
export { useEditor };
