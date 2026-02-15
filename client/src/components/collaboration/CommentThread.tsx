/**
 * Comment Thread Component
 * Inline comments with replies and resolution
 */
import { useState } from 'react';
import { Send, CheckCircle, MessageSquare, X } from 'lucide-react';
import type { Comment, CommentFormData } from '@/types';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface CommentThreadProps {
  comments: Comment[];
  sectionId: string;
  onAddComment: (comment: CommentFormData) => void;
  onResolveComment: (commentId: string) => void;
  onRemoveComment: (commentId: string) => void;
}

export default function CommentThread({
  comments,
  sectionId,
  onAddComment,
  onResolveComment,
  onRemoveComment,
}: CommentThreadProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Filter comments for this section
  const sectionComments = comments.filter((c) => c.sectionId === sectionId && !c.parentId);

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;

    onAddComment({
      content: newCommentText.trim(),
      sectionId,
    });

    setNewCommentText('');
  };

  const handleAddReply = (parentId: string) => {
    if (!replyText.trim()) return;

    onAddComment({
      content: replyText.trim(),
      sectionId,
      parentId,
    });

    setReplyText('');
    setReplyingTo(null);
  };

  const getReplies = (parentId: string) => {
    return comments.filter((c) => c.parentId === parentId);
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const replies = getReplies(comment.id);

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`${isReply ? 'ml-8 mt-2' : ''} ${comment.resolved ? 'opacity-60' : ''}`}
      >
        <div
          className={`border-l-2 rounded-r-lg p-4 ${
            comment.resolved
              ? 'border-status-completed bg-status-completed/5'
              : 'border-status-pending bg-status-pending/5'
          }`}
        >
          {/* Comment Header */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                comment.resolved
                  ? 'bg-status-completed/20 text-status-completed'
                  : 'bg-status-pending/20 text-status-pending'
              }`}
            >
              {comment.userInitials}
            </div>
            <span className="text-xs font-medium text-foreground">{comment.userName}</span>
            <span className="text-xs text-muted-foreground">
              {format(comment.timestamp, 'MMM d, h:mm a')}
            </span>
            {comment.resolved && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-status-completed/15 text-status-completed text-[10px] font-medium">
                <CheckCircle size={10} />
                Resolved
              </span>
            )}
            <div className="flex-1" />
            {!comment.resolved && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onResolveComment(comment.id)}
                  className="p-1 rounded hover:bg-status-completed/10 text-muted-foreground hover:text-status-completed transition-colors"
                  title="Resolve comment"
                >
                  <CheckCircle size={14} />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) {
                      onRemoveComment(comment.id);
                    }
                  }}
                  className="p-1 rounded hover:bg-status-delayed/10 text-muted-foreground hover:text-status-delayed transition-colors"
                  title="Delete comment"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Comment Content */}
          <p className="text-sm text-foreground leading-relaxed">{comment.content}</p>

          {/* Reply Button */}
          {!comment.resolved && !isReply && (
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="inline-flex items-center gap-1 mt-2 text-xs text-journi-green hover:underline"
            >
              <MessageSquare size={12} />
              Reply
            </button>
          )}
        </div>

        {/* Reply Input */}
        {replyingTo === comment.id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="ml-8 mt-2 flex items-center gap-2 bg-accent rounded-lg px-3 py-2"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddReply(comment.id);
                if (e.key === 'Escape') setReplyingTo(null);
              }}
              placeholder="Write a reply..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />
            <button
              onClick={() => handleAddReply(comment.id)}
              className="text-journi-green hover:opacity-80 transition-opacity"
            >
              <Send size={16} />
            </button>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        {/* Replies */}
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Comments List */}
      {sectionComments.length > 0 && (
        <div className="space-y-3">
          {sectionComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* Add Comment Input */}
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
        <input
          type="text"
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddComment();
          }}
          placeholder="Add a comment..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          onClick={handleAddComment}
          className="text-journi-green hover:opacity-80 transition-opacity"
          disabled={!newCommentText.trim()}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Info */}
      {sectionComments.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No comments yet. Add one to start a discussion.
        </p>
      )}
    </div>
  );
}
