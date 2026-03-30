/**
 * SearchBar Component
 * Debounced search input for journal discovery
 */
import { Search, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  dark?: boolean;
}

export default function SearchBar({ onSearch, dark = false }: SearchBarProps) {
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
      <Search
        size={18}
        className={`absolute left-4 top-1/2 -translate-y-1/2 ${dark ? 'text-white/50' : 'text-muted-foreground'}`}
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by topic, journal, or conference..."
        autoComplete="off"
        aria-label="Search journals"
        className={`w-full pl-11 pr-10 py-3.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#9999cc]/40 focus:border-[#9999cc] transition-all shadow-xl
          ${dark
            ? 'bg-white/10 border-white/20 text-white placeholder:text-white/40 backdrop-blur-sm'
            : 'bg-card border-border text-foreground placeholder:text-muted-foreground'
          }`}
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          aria-label="Clear search"
          className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${dark ? 'text-white/50 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
