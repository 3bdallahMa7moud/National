import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { LegendEmployee, ValidateResult } from '@/types/scheduleMatrix';

interface EmployeeComboboxProps {
  label: string;
  legend: LegendEmployee[];
  value: string | null;
  onChange: (code: string | null) => void;
  /** Optional: called when X is clicked. Replaces onChange(null) so the parent can persist the removal immediately. */
  onRemove?: () => void;
  onValidate: (code: string) => ValidateResult | null;
  disabled?: boolean;
}

export function EmployeeCombobox({
  label,
  legend,
  value,
  onChange,
  onRemove,
  onValidate,
  disabled = false,
}: EmployeeComboboxProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = useMemo(() => {
    return value ? (legend || []).find((e) => e?.code === value) || null : null;
  }, [value, legend]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return legend || [];
    return (legend || []).filter(
      (employee) =>
        (employee?.code || '').toLowerCase().includes(query) ||
        (employee?.fullName || '').toLowerCase().includes(query),
    );
  }, [legend, search]);

  // Reset highlighted index whenever filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered]);

  const currentConflict = value ? onValidate(value) : null;
  const hasConflict = currentConflict && !currentConflict.ok;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    } else {
      onChange(null);
    }
    setSearch('');
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered.length > 0) {
          handleSelect(filtered[highlightedIndex].code);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-xl border transition-colors',
        value
          ? hasConflict
            ? 'border-danger/40 bg-danger-500/5'
            : 'border-primary-teal/40 bg-primary-teal/5'
          : 'border-dashed border-border bg-surface-muted/35',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="p-3">
        {/* Label row */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
            {label}
          </span>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-danger-500/10 hover:text-danger"
              aria-label={t('schedule:assignment.remove')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Input trigger */}
        <div
          className="relative flex min-h-11 cursor-text items-center rounded-lg border border-border bg-surface px-3 transition-colors focus-within:border-primary-teal focus-within:ring-2 focus-within:ring-primary-teal/20"
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
        >
          {selectedEmployee && !isOpen ? (
            <div className="flex w-full items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-primary-teal/35 bg-primary-teal text-[10px] font-black text-white">
                {selectedEmployee.code}
              </span>
              <span className="flex-1 truncate text-sm font-bold text-text-primary">
                {selectedEmployee.fullName}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
            </div>
          ) : (
            <div className="flex w-full items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  selectedEmployee
                    ? selectedEmployee.fullName
                    : t('schedule:assignment.searchPlaceholder')
                }
                className="w-full bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted"
              />
              <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
            </div>
          )}
        </div>

        {/* Conflict warning */}
        {hasConflict && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-danger/25 bg-danger-500/10 px-2 py-1.5 text-[11px] font-semibold text-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {t('schedule:assignment.conflictWith', {
                facility: currentConflict.conflict.facility,
                unit: currentConflict.conflict.unit,
                shift: currentConflict.conflict.shiftLabel,
              })}
            </span>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-dropdown animate-in fade-in zoom-in-95 duration-100">
          <div ref={listRef} className="max-h-[240px] overflow-y-auto">
            {filtered.map((employee, idx) => {
              const isSelected = value === employee.code;
              const isHighlighted = idx === highlightedIndex;
              const result = onValidate(employee.code);
              const hasIssue = result ? !result.ok : false;

              return (
                <button
                  key={employee.code}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelect(employee.code)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-border px-3 py-3 text-start transition-colors last:border-b-0',
                    isSelected
                      ? 'bg-primary-teal/10'
                      : isHighlighted
                        ? 'bg-hover'
                        : 'hover:bg-hover',
                    hasIssue && !isSelected && 'opacity-70',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[10px] font-black',
                      isSelected
                        ? 'border-primary-teal bg-primary-teal text-white'
                        : 'border-border bg-surface-muted text-text-primary',
                    )}
                  >
                    {employee.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-text-primary">
                      {employee.fullName}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary-teal" />}
                  {hasIssue && !isSelected && (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-sm font-semibold text-text-muted">
                {t('schedule:assignment.noResults')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
