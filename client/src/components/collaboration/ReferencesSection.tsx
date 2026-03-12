/**
 * References Section Component
 * Displays auto-formatted citations in APA style
 */
import { Trash2, BookOpen, FileText, ExternalLink } from 'lucide-react';
import type { Citation } from '@/types';
import { motion } from 'framer-motion';

interface ReferencesSectionProps {
  citations: Citation[];
  onRemoveCitation: (citationId: string) => void;
}

export default function ReferencesSection({ citations, onRemoveCitation }: ReferencesSectionProps) {
  // Format citation in APA style
  const formatCitation = (citation: Citation): string => {
    const { authors, year, title, journal, volume, pages, doi, url, type } = citation;

    // Format authors (last names with initials)
    const authorStr = authors.join(', ');

    // Base format: Authors (Year). Title.
    let formatted = `${authorStr} (${year}). ${title}.`;

    // Add type-specific formatting
    if (type === 'article' && journal) {
      formatted += ` <em>${journal}</em>`;
      if (volume) formatted += `, ${volume}`;
      if (pages) formatted += `, ${pages}`;
      if (doi) formatted += `. https://doi.org/${doi}`;
    } else if (type === 'website' && url) {
      formatted += ` Retrieved from ${url}`;
    }

    return formatted;
  };

  if (citations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <BookOpen size={24} className="text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-2">No citations yet</p>
        <p className="text-xs text-muted-foreground">
          Citations you add will appear here in APA format
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground">References</h3>
        <span className="text-xs text-muted-foreground">
          {citations.length} {citations.length === 1 ? 'citation' : 'citations'}
        </span>
      </div>

      <div className="space-y-3">
        {citations.map((citation, index) => (
          <motion.div
            key={citation.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            className="group relative pl-8 pr-4 py-3 bg-card border border-border rounded-lg hover:border-journi-green/30 transition-colors"
          >
            {/* Citation Number */}
            <div className="absolute left-3 top-3 w-5 h-5 rounded-full bg-journi-green/15 flex items-center justify-center text-[10px] font-bold text-journi-green">
              {index + 1}
            </div>

            {/* Citation Text */}
            <div
              className="text-sm text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatCitation(citation) }}
            />

            {/* Free PDF / OA links */}
            {(citation.freePdfUrl || (citation.doi && citation.oaStatus && citation.oaStatus !== 'closed')) && (
              <div className="flex items-center gap-2 mt-2">
                {citation.freePdfUrl && (
                  <a
                    href={citation.freePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold hover:opacity-80 transition-opacity"
                  >
                    <FileText size={10} />
                    Free PDF
                  </a>
                )}
                {citation.oaStatus && citation.oaStatus !== 'closed' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-medium capitalize">
                    {citation.oaStatus}
                  </span>
                )}
              </div>
            )}

            {/* Remove Button */}
            <button
              onClick={() => {
                if (window.confirm('Remove this citation?')) {
                  onRemoveCitation(citation.id);
                }
              }}
              className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-status-delayed/10 text-muted-foreground hover:text-status-delayed transition-all"
              title="Remove citation"
            >
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Citation Style Info */}
      <div className="mt-6 p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Format:</strong> APA 7th Edition &middot; Citations
          are automatically sorted and formatted
        </p>
      </div>
    </div>
  );
}
