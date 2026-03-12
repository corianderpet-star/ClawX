/**
 * ModelIdCombobox — dropdown + free-text input for selecting a model ID.
 *
 * Features:
 *  - Fetches model list from backend when `providerType` + `accountId` are set.
 *  - Supports free-text typing (the dropdown is optional).
 *  - Shows loading spinner while fetching.
 *  - Caches results per provider+account to avoid repeated fetches.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';

export interface ModelIdComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  providerType?: string;
  accountId?: string;
  baseUrl?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  owned_by?: string;
}

// In-memory cache: key = `${providerType}:${accountId}:${baseUrl}`
const modelCache = new Map<string, { models: ModelOption[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function cacheKey(providerType: string, accountId: string, baseUrl?: string): string {
  return `${providerType}:${accountId}:${baseUrl ?? ''}`;
}

export function ModelIdCombobox({
  value,
  onChange,
  placeholder = 'Select or type model ID',
  providerType,
  accountId,
  baseUrl,
  className,
  id,
  disabled,
}: ModelIdComboboxProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Whether we should fetch models for this provider type
  const canFetch = Boolean(providerType);

  const fetchModels = useCallback(
    async (force = false) => {
      if (!providerType) return;
      const key = cacheKey(providerType, accountId ?? '', baseUrl);
      if (!force) {
        const cached = modelCache.get(key);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
          setModels(cached.models);
          return;
        }
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({ type: providerType });
        if (accountId) params.set('accountId', accountId);
        if (baseUrl) params.set('baseUrl', baseUrl);
        const resp = await hostApiFetch<{ models: ModelOption[] }>(
          `/api/provider-models?${params.toString()}`,
        );
        const list = resp?.models ?? [];
        setModels(list);
        modelCache.set(key, { models: list, ts: Date.now() });
      } catch {
        setModels([]);
      } finally {
        setLoading(false);
      }
    },
    [providerType, accountId, baseUrl],
  );

  // Fetch on mount / provider change
  useEffect(() => {
    if (canFetch) {
      fetchModels();
    } else {
      setModels([]);
    }
  }, [canFetch, fetchModels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilterText('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = useMemo(() => {
    const query = (filterText || value).toLowerCase();
    if (!query) return models;
    return models.filter(
      (m) => m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query),
    );
  }, [models, filterText, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setFilterText(v);
    if (!open && v) setOpen(true);
  };

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setFilterText('');
    setOpen(false);
  };

  const handleInputFocus = () => {
    if (models.length > 0) {
      setOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setFilterText('');
    }
  };

  const hasDropdown = models.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasDropdown && 'pr-16',
            className,
          )}
        />
        {/* Right-side icons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {canFetch && !loading && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                fetchModels(true);
              }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh model list"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {hasDropdown && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                setOpen(!open);
                if (!open) inputRef.current?.focus();
              }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown list */}
      {open && hasDropdown && (
        <div
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-input bg-popover shadow-md"
        >
          {filteredModels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matching models</div>
          ) : (
            filteredModels.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer',
                  m.id === value && 'bg-accent/50 font-medium',
                )}
                onClick={() => handleSelect(m.id)}
              >
                <span className="font-mono text-xs">{m.id}</span>
                {m.name !== m.id && (
                  <span className="ml-2 text-muted-foreground text-xs">{m.name}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
