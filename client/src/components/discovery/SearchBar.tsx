/**
 * SearchBar Component
 * Debounced search input for journal discovery
 */
import { Search, X } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchRef.current(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  return (
    <div className="relative max-w-xl mx-auto">
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by topic, journal, or conference..."
        className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-journi-green/30 focus:border-journi-green transition-all"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
