/**
 * Citation Dialog Component
 * Form for adding citations with auto-formatting and smart lookup
 */
import { useState, useEffect } from 'react';
import { X, BookOpen, Search, Loader2, Sparkles, ChevronRight, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import type { CitationFormData, CitationType } from '@/types';
import { smartLookup, type LookupResult } from '@/lib/citation-lookup';
import { getFreePdf } from '@/lib/unpaywall-api';

interface CitationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (citation: CitationFormData) => void;
}

type TabMode = 'smart' | 'manual';

const citationTypes: { value: CitationType; label: string }[] = [
  { value: 'article', label: 'Journal Article' },
  { value: 'book', label: 'Book' },
  { value: 'website', label: 'Website' },
];

const emptyForm: CitationFormData & { volume?: string; pages?: string; issue?: string; publisher?: string } = {
  authors: [],
  title: '',
  year: new Date().getFullYear(),
  type: 'article',
  journal: '',
  volume: '',
  pages: '',
  doi: '',
  url: '',
};

export default function CitationDialog({ isOpen, onClose, onSubmit }: CitationDialogProps) {
  const [tab, setTab] = useState<TabMode>('smart');
  const [formData, setFormData] = useState(emptyForm);
  const [authorInput, setAuthorInput] = useState('');
  const [formError, setFormError] = useState('');

  // Smart lookup state
  const [smartInput, setSmartInput] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [searchResults, setSearchResults] = useState<LookupResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<LookupResult | null>(null);
  const [freePdfUrl, setFreePdfUrl] = useState<string | null>(null);
  const [oaStatus, setOaStatus] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(emptyForm);
      setAuthorInput('');
      setSmartInput('');
      setIsLooking(false);
      setLookupError('');
      setSearchResults([]);
      setSelectedResult(null);
      setFreePdfUrl(null);
      setOaStatus(null);
      setTab('smart');
      setFormError('');
    }
  }, [isOpen]);

  // ---- Smart Lookup ----

  const handleSmartLookup = async () => {
    if (!smartInput.trim()) return;

    setIsLooking(true);
    setLookupError('');
    setSearchResults([]);
    setSelectedResult(null);

    try {
      const outcome = await smartLookup(smartInput.trim());

      if (outcome.type === 'single') {
        applyResult(outcome.result);
      } else {
        if (outcome.results.results.length === 0) {
          setLookupError('No results found. Try a different search term or enter the DOI directly.');
        } else {
          setSearchResults(outcome.results.results);
        }
      }
    } catch (err: any) {
      setLookupError(err.message || 'Lookup failed. Please try again.');
    } finally {
      setIsLooking(false);
    }
  };

  const applyResult = (result: LookupResult) => {
    setSelectedResult(result);
    setSearchResults([]);
    setFreePdfUrl(null);
    setOaStatus(null);
    setFormData({
      authors: result.authors,
      title: result.title,
      year: result.year,
      type: result.type,
      journal: result.journal || '',
      doi: result.doi || '',
      url: result.url || '',
      volume: result.volume || '',
      pages: result.pages || '',
      issue: result.issue || '',
      publisher: result.publisher || '',
    });

    // Fire-and-forget Unpaywall lookup for the free PDF
    if (result.doi) {
      getFreePdf(result.doi).then((unpaywall) => {
        if (unpaywall) {
          setFreePdfUrl(unpaywall.pdfUrl);
          setOaStatus(unpaywall.oaStatus);
        }
      }).catch(() => {});
    }
  };

  const handleSmartKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSmartLookup();
    }
  };

  // ---- Manual Form ----

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formData.authors.length === 0) {
      setFormError('Please add at least one author');
      return;
    }
    if (!formData.title.trim()) {
      setFormError('Please enter a title');
      return;
    }
    if (!formData.year || formData.year < 1900 || formData.year > new Date().getFullYear() + 10) {
      setFormError('Please enter a valid year');
      return;
    }

    onSubmit(formData);
    onClose();
  };

  const handleAddAuthor = () => {
    if (authorInput.trim()) {
      setFormData({
        ...formData,
        authors: [...formData.authors, authorInput.trim()],
      });
      setAuthorInput('');
    }
  };

  const handleRemoveAuthor = (index: number) => {
    setFormData({
      ...formData,
      authors: formData.authors.filter((_, i) => i !== index),
    });
  };

  const handleAuthorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAuthor();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-journi-green/15 flex items-center justify-center">
                <BookOpen size={20} className="text-journi-green" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Add Citation</h2>
                <p className="text-xs text-muted-foreground">
                  {tab === 'smart' ? 'Paste a DOI, URL, or paper title' : 'Fill in citation details manually'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab('smart')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9999cc]/40 ${
                tab === 'smart'
                  ? 'text-[#8b86c4] border-b-2 border-[#8b86c4]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles size={16} />
              Smart Add
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9999cc]/40 ${
                tab === 'manual'
                  ? 'text-[#8b86c4] border-b-2 border-[#8b86c4]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen size={16} />
              Manual Entry
            </button>
          </div>

          {/* Smart Add Tab */}
          {tab === 'smart' && (
            <div className="p-6 space-y-5">
              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  DOI, URL, or Paper Title
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={smartInput}
                      onChange={(e) => setSmartInput(e.target.value)}
                      onKeyDown={handleSmartKeyDown}
                      placeholder="e.g., 10.1038/nature12373 or paste a URL or title..."
                      className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSmartLookup}
                    disabled={isLooking || !smartInput.trim()}
                    className="px-5 py-2.5 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLooking ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Looking up...
                      </>
                    ) : (
                      'Lookup'
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Supports DOIs (e.g., 10.1038/nature12373), full DOI URLs, article URLs, or paper titles
                </p>
              </div>

              {/* Error */}
              {lookupError && (
                <div className="flex items-start gap-3 p-4 bg-status-delayed/10 border border-status-delayed/20 rounded-lg">
                  <AlertCircle size={18} className="text-status-delayed shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-foreground">{lookupError}</p>
                    <button
                      type="button"
                      onClick={() => { setTab('manual'); setLookupError(''); }}
                      className="mt-1 text-xs text-journi-green hover:underline"
                    >
                      Switch to manual entry instead
                    </button>
                  </div>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">
                    Select the correct paper ({searchResults.length} results)
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((result, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applyResult(result)}
                        className="w-full text-left p-4 bg-background border border-border rounded-lg hover:border-journi-green/50 hover:bg-journi-green/5 transition-colors group"
                      >
                        <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-journi-green transition-colors">
                          {result.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.authors.slice(0, 3).join(', ')}
                          {result.authors.length > 3 && ` +${result.authors.length - 3} more`}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {result.journal && <span>{result.journal}</span>}
                          <span>{result.year}</span>
                          {result.doi && (
                            <span className="text-journi-green/70">DOI: {result.doi}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Result Preview */}
              {selectedResult && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-journi-green/5 border border-journi-green/20 rounded-lg">
                    <CheckCircle2 size={18} className="text-journi-green shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{selectedResult.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedResult.authors.join(', ')} ({selectedResult.year})
                      </p>
                      {selectedResult.journal && (
                        <p className="text-xs text-muted-foreground italic">{selectedResult.journal}</p>
                      )}
                      {selectedResult.doi && (
                        <p className="text-xs text-journi-green/70 mt-1">DOI: {selectedResult.doi}</p>
                      )}
                      {freePdfUrl && (
                        <a
                          href={freePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[10px] font-semibold hover:opacity-80 transition-opacity"
                        >
                          <FileText size={10} />
                          Free PDF available
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedResult(null); setSmartInput(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Edit before adding */}
                  <button
                    type="button"
                    onClick={() => setTab('manual')}
                    className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Want to edit details before adding? Switch to Manual Entry
                    <ChevronRight size={14} />
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSubmit({
                          ...formData,
                          freePdfUrl: freePdfUrl ?? undefined,
                          oaStatus: (oaStatus as any) ?? undefined,
                        });
                        onClose();
                      }}
                      className="flex-1 px-4 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Add Citation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Tab */}
          {tab === 'manual' && (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-600 text-sm">
                  {formError}
                </div>
              )}
              {/* Citation Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Type <span className="text-status-delayed">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as CitationType })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                >
                  {citationTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Authors */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Authors <span className="text-status-delayed">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={authorInput}
                      onChange={(e) => setAuthorInput(e.target.value)}
                      onKeyDown={handleAuthorKeyDown}
                      placeholder="e.g., Smith, J."
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                    />
                    <button
                      type="button"
                      onClick={handleAddAuthor}
                      className="px-4 py-2 bg-journi-green/10 text-journi-green rounded-lg text-sm font-medium hover:bg-journi-green/20 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {formData.authors.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.authors.map((author, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent rounded-full text-sm text-foreground"
                        >
                          {author}
                          <button
                            type="button"
                            onClick={() => handleRemoveAuthor(index)}
                            className="hover:text-status-delayed transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Title <span className="text-status-delayed">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Article or book title"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Year <span className="text-status-delayed">*</span>
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  min="1900"
                  max={new Date().getFullYear() + 10}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
              </div>

              {/* Conditional Fields */}
              {formData.type === 'article' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Journal</label>
                    <input
                      type="text"
                      value={formData.journal}
                      onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
                      placeholder="Journal name"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Volume</label>
                      <input
                        type="text"
                        value={formData.volume}
                        onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                        placeholder="e.g., 42"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Pages</label>
                      <input
                        type="text"
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        placeholder="e.g., 123-145"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      DOI (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.doi}
                      onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                      placeholder="10.1234/example.doi"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                    />
                  </div>
                </>
              )}

              {formData.type === 'website' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Add Citation
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
