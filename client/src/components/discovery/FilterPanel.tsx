/**
 * FilterPanel Component
 * All 5 filters for journal discovery
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import type { JournalFilters } from '@/types';
import { ALL_SUBJECT_AREAS, ALL_GEOGRAPHIC_LOCATIONS } from '@/data/journals-database';

interface FilterPanelProps {
  filters: JournalFilters;
  onFiltersChange: (filters: JournalFilters) => void;
}

const SUBJECT_AREAS = ALL_SUBJECT_AREAS;
const GEOGRAPHIC_LOCATIONS = ALL_GEOGRAPHIC_LOCATIONS;

export default function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const toggleFilter = (filterName: string) => {
    setExpandedFilter(expandedFilter === filterName ? null : filterName);
  };

  const updateFilters = (updates: Partial<JournalFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleSubjectArea = (area: string) => {
    const current = filters.subjectAreas || [];
    const updated = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    updateFilters({ subjectAreas: updated });
  };

  const toggleGeographicLocation = (location: string) => {
    const current = filters.geographicLocations || [];
    const updated = current.includes(location)
      ? current.filter((l) => l !== location)
      : [...current, location];
    updateFilters({ geographicLocations: updated });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  // Safe accessors with defaults
  const impactMin = filters.impactFactorMin ?? 0;
  const impactMax = filters.impactFactorMax ?? 300;
  const timeMax = filters.timeToPublicationMax ?? 300;

  const hasActiveFilters =
    filters.impactFactorMin !== undefined ||
    filters.impactFactorMax !== undefined ||
    filters.openAccess !== undefined ||
    (filters.subjectAreas && filters.subjectAreas.length > 0) ||
    (filters.geographicLocations && filters.geographicLocations.length > 0) ||
    filters.timeToPublicationMax !== undefined;

  const FilterButton = ({ name, label }: { name: string; label: string }) => {
    const isExpanded = expandedFilter === name;
    const Icon = isExpanded ? ChevronUp : ChevronDown;

    return (
      <button
        onClick={() => toggleFilter(name)}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
          isExpanded
            ? 'border-journi-green bg-journi-green/5 text-journi-green'
            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20'
        }`}
      >
        {label}
        <Icon size={13} />
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <FilterButton name="impactFactor" label="Impact Factor" />
        <FilterButton name="openAccess" label="Open Access" />
        <FilterButton name="subjectArea" label="Subject Area" />
        <FilterButton name="location" label="Geographic Location" />
        <FilterButton name="timeToPublication" label="Time to Publication" />
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-status-delayed/10 text-status-delayed text-xs font-medium hover:bg-status-delayed/20 transition-colors"
          >
            <X size={13} />
            Clear All
          </button>
        )}
      </div>

      {/* Filter Panels */}
      <div className="max-w-2xl mx-auto">
        {/* Impact Factor */}
        {expandedFilter === 'impactFactor' && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-foreground mb-4">Impact Factor Range</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Min</label>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="0.5"
                    value={impactMin}
                    onChange={(e) => updateFilters({ impactFactorMin: parseFloat(e.target.value) })}
                    className="w-full accent-journi-green"
                  />
                  <div className="text-xs font-medium text-foreground mt-1">
                    {impactMin.toFixed(1)}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Max</label>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="0.5"
                    value={impactMax}
                    onChange={(e) => updateFilters({ impactFactorMax: parseFloat(e.target.value) })}
                    className="w-full accent-journi-green"
                  />
                  <div className="text-xs font-medium text-foreground mt-1">
                    {impactMax.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Open Access */}
        {expandedFilter === 'openAccess' && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-foreground mb-4">Open Access</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="openAccess"
                  checked={filters.openAccess === undefined}
                  onChange={() => {
                    const { openAccess, ...rest } = filters;
                    onFiltersChange(rest);
                  }}
                  className="accent-journi-green"
                />
                <span className="text-sm text-foreground">All Journals</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="openAccess"
                  checked={filters.openAccess === true}
                  onChange={() => updateFilters({ openAccess: true })}
                  className="accent-journi-green"
                />
                <span className="text-sm text-foreground">Open Access Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="openAccess"
                  checked={filters.openAccess === false}
                  onChange={() => updateFilters({ openAccess: false })}
                  className="accent-journi-green"
                />
                <span className="text-sm text-foreground">Subscription Only</span>
              </label>
            </div>
          </div>
        )}

        {/* Subject Area */}
        {expandedFilter === 'subjectArea' && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-foreground mb-4">Subject Areas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {SUBJECT_AREAS.map((area) => {
                const isSelected = filters.subjectAreas?.includes(area) || false;
                return (
                  <button
                    key={area}
                    onClick={() => toggleSubjectArea(area)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-journi-green/10 border-2 border-journi-green text-journi-green'
                        : 'bg-muted border-2 border-transparent text-foreground hover:bg-accent'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-journi-green border-journi-green' : 'border-border'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    {area}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Geographic Location */}
        {expandedFilter === 'location' && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-foreground mb-4">Geographic Location</h3>
            <div className="space-y-2">
              {GEOGRAPHIC_LOCATIONS.map((location) => {
                const isSelected = filters.geographicLocations?.includes(location) || false;
                return (
                  <button
                    key={location}
                    onClick={() => toggleGeographicLocation(location)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-journi-green/10 text-journi-green font-medium'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-journi-green border-journi-green' : 'border-border'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    {location}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Time to Publication */}
        {expandedFilter === 'timeToPublication' && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-foreground mb-4">Time to Publication (Max Days)</h3>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="300"
                step="5"
                value={timeMax}
                onChange={(e) => updateFilters({ timeToPublicationMax: parseInt(e.target.value) })}
                className="w-full accent-journi-green"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">0 days</span>
                <span className="text-sm font-medium text-journi-green">
                  {timeMax} days
                </span>
                <span className="text-xs text-muted-foreground">300 days</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
