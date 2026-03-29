/**
 * References Section Component
 * Displays citations formatted in Vancouver, APA, or MLA style.
 * Server-formatted output is fetched when a manuscriptId is provided;
 * falls back to local formatting otherwise.
 */
import { useState, useEffect } from 'react';
import { Trash2, BookOpen, FileText, Copy, Check } from 'lucide-react';
import type { Citation } from '@/types';
import { motion } from 'framer-motion';
import { fetchCitationsFormatted } from '@/lib/api/backend';

type CitationFormat = 'vancouver' | 'apa' | 'mla';

interface ReferencesSectionProps {
  citations: Citation[];
  onRemoveCitation: (citationId: string) => void;
  manuscriptId?: string;
}

// ── Local fallback formatters ────────────────────────────────────────────────

function authorInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => p[0]?.toUpperCase() + '.').join('');
  return `${last} ${initials}`;
}

function formatVancouver(c: Citation, num: number): string {
  const authors = c.authors.map(authorInitials).join(', ');
  let s = `${num}. ${authors}. ${c.title}.`;
  if (c.type === 'article' && c.journal) {
    const year = c.year ?? '?';
    s += ` ${c.journal}.`;
    if (c.volume) s += ` ${c.year};${c.volume}`;
    if (c.pages) s += `:${c.pages}`;
    else s += `.`;
    if (c.doi) s += ` doi:${c.doi}`;
  }
  return s;
}

function formatApa(c: Citation, _num: number): string {
  const authors = c.authors.join(', ');
  let s = `${authors} (${c.year}). ${c.title}.`;
  if (c.type === 'article' && c.journal) {
    s += ` <em>${c.journal}</em>`;
    if (c.volume) s += `, <em>${c.volume}</em>`;
    if (c.pages) s += `, ${c.pages}`;
    if (c.doi) s += `. https://doi.org/${c.doi}`;
  } else if (c.type === 'website' && c.url) {
    s += ` Retrieved from ${c.url}`;
  }
  return s;
}

function formatMla(c: Citation, _num: number): string {
  const authors = c.authors.length > 1
    ? `${c.authors[0]}, et al.`
    : c.authors[0] ?? '';
  let s = `${authors}. "${c.title}."`;
  if (c.type === 'article' && c.journal) {
    s += ` <em>${c.journal}</em>`;
    if (c.volume) s += `, vol. ${c.volume}`;
    if (c.year) s += `, ${c.year}`;
    if (c.pages) s += `, pp. ${c.pages}`;
    if (c.doi) s += `. doi:${c.doi}`;
  }
  return s + '.';
}

function localFormat(c: Citation, format: CitationFormat, num: number): string {
  if (format === 'vancouver') return formatVancouver(c, num);
  if (format === 'mla') return formatMla(c, num);
  return formatApa(c, num);
}

// ── Component ────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<CitationFormat, string> = {
  vancouver: 'Vancouver',
  apa: 'APA 7th',
  mla: 'MLA 9th',
};

export default function ReferencesSection({ citations, onRemoveCitation, manuscriptId }: ReferencesSectionProps) {
  const [format, setFormat] = useState<CitationFormat>('vancouver');
  const [serverFormatted, setServerFormatted] = useState<Record<string, string> | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!manuscriptId || citations.length === 0) {
      setServerFormatted(null);
      return;
    }
    fetchCitationsFormatted(manuscriptId, format)
      .then((res) => {
        if (!res.data) return;
        const map: Record<string, string> = {};
        for (const item of res.data) map[item.id] = item.formatted;
        setServerFormatted(map);
      })
      .catch(() => setServerFormatted(null));
  }, [manuscriptId, format, citations.length]);

  const getFormatted = (c: Citation, i: number): string =>
    serverFormatted?.[c.id] ?? localFormat(c, format, i + 1);

  const handleCopyAll = () => {
    const text = citations
      .map((c, i) => {
        const html = getFormatted(c, i);
        return html.replace(/<[^>]+>/g, '');
      })
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  if (citations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <BookOpen size={24} className="text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-2">No citations yet</p>
        <p className="text-xs text-muted-foreground">
          Citations you add will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + format selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">References</h3>
        <div className="flex items-center gap-1.5 bg-muted rounded-lg p-0.5">
          {(Object.keys(FORMAT_LABELS) as CitationFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                format === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
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
              dangerouslySetInnerHTML={{ __html: getFormatted(citation, index) }}
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

      {/* Copy all */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {citations.length} {citations.length === 1 ? 'citation' : 'citations'} &middot; {FORMAT_LABELS[format]}
        </p>
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
        >
          {isCopied ? <Check size={13} className="text-journi-green" /> : <Copy size={13} />}
          {isCopied ? 'Copied!' : 'Copy all'}
        </button>
      </div>
    </div>
  );
}
