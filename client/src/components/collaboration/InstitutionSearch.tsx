/**
 * Institution Search — debounced autocomplete backed by the ROR API.
 * Standardizes institution names using the Research Organization Registry.
 */
import { useState, useEffect, useRef } from 'react';
import { Building2, Loader2, X } from 'lucide-react';
import { searchInstitutions, type RorOrganization } from '@/lib/ror-api';

interface InstitutionSearchProps {
  value: string;
  rorId?: string;
  countryName?: string;
  onChange: (value: string, rorId?: string, countryName?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function InstitutionSearch({
  value,
  rorId,
  countryName,
  onChange,
  placeholder = 'Search for institution...',
  disabled = false,
}: InstitutionSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<RorOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced ROR search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query === value) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const orgs = await searchInstitutions(query, 8);
        setResults(orgs);
        setIsOpen(orgs.length > 0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(org: RorOrganization) {
    const name = org.name;
    setQuery(name);
    setIsOpen(false);
    setResults([]);
    onChange(name, org.rorId, org.countryName ?? undefined);
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onChange('', undefined, undefined);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setQuery(newValue);
    // If user is typing a new value, clear rorId
    if (newValue !== value) {
      onChange(newValue, undefined, undefined);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Building2
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-9 pr-8 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isLoading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
          />
        )}
        {!isLoading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ROR ID indicator */}
      {rorId && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Verified via ROR
          {countryName && ` · ${countryName}`}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {results.map((org) => (
            <button
              key={org.rorId}
              type="button"
              onClick={() => handleSelect(org)}
              className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
            >
              <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
              <p className="text-xs text-muted-foreground">
                {[org.city, org.countryName].filter(Boolean).join(', ')}
                {org.types.length > 0 && ` · ${org.types[0]}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
