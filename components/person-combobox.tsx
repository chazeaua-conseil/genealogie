"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  displayNameSurnameFirst,
  lifespan,
  normalizeSearch,
  personSearchKey,
} from "@/lib/person-display";

export type PersonOption = {
  id: string;
  givenName: string | null;
  surname: string | null;
  marriedName?: string | null;
  nickname?: string | null;
  sex?: "MALE" | "FEMALE" | "UNKNOWN";
  isLiving?: boolean;
  birthYear?: number | null;
  deathYear?: number | null;
};

const MAX_SUGGESTIONS = 8;

/**
 * Type-ahead person picker, used everywhere a person has to be chosen
 * (parents, partner, children, global search) in place of a `<select>` that
 * becomes unusable past a few dozen people.
 *
 * Two data sources:
 *  - `persons`: filtered locally (the pool is already on the page);
 *  - `search`: async lookup, debounced, for the tree-wide global search.
 *
 * Two output modes:
 *  - `name` given → renders a hidden input carrying the selected id, so the
 *    component drops into a plain <form> / Server Action;
 *  - `onSelect` given → reports the pick to the caller and clears itself,
 *    for "add to a list" pickers.
 */
export function PersonCombobox({
  id,
  name,
  persons,
  search,
  defaultPerson = null,
  placeholder = "Rechercher une personne…",
  excludeIds,
  required = false,
  autoFocus = false,
  clearOnSelect = false,
  onSelect,
  emptyMessage = "Aucune personne ne correspond",
  className,
  inputClassName,
  size = "default",
}: {
  id?: string;
  name?: string;
  persons?: PersonOption[];
  search?: (query: string, signal: AbortSignal) => Promise<PersonOption[]>;
  defaultPerson?: PersonOption | null;
  placeholder?: string;
  excludeIds?: string[];
  required?: boolean;
  autoFocus?: boolean;
  clearOnSelect?: boolean;
  onSelect?: (person: PersonOption) => void;
  emptyMessage?: string;
  className?: string;
  inputClassName?: string;
  size?: "default" | "lg";
}) {
  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;

  const [selected, setSelected] = useState<PersonOption | null>(defaultPerson);
  const [query, setQuery] = useState(
    defaultPerson ? displayNameSurnameFirst(defaultPerson) : "",
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remote, setRemote] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  // Local filtering. Empty query lists the first names alphabetically so the
  // field is still browsable without typing.
  const localResults = useMemo(() => {
    if (!persons) return [];
    const pool = persons.filter((p) => !excluded.has(p.id));
    const q = normalizeSearch(query.trim());
    if (!q) return pool.slice(0, MAX_SUGGESTIONS);
    const starts: PersonOption[] = [];
    const contains: PersonOption[] = [];
    for (const p of pool) {
      const key = personSearchKey(p);
      if (key.startsWith(q)) starts.push(p);
      else if (key.includes(q)) contains.push(p);
      // Also match "surname givenName" order, which is how the list reads.
      else if (normalizeSearch(displayNameSurnameFirst(p)).includes(q))
        contains.push(p);
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [persons, query, excluded]);

  const results = search ? remote : localResults;

  // Async lookup, debounced, with the previous request aborted. Every state
  // update happens inside the timer callback, never synchronously in the
  // effect body, so a keystroke doesn't cascade an extra render.
  useEffect(() => {
    if (!search) return;
    const q = query.trim();
    if (selected && displayNameSurnameFirst(selected) === query) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (q.length < 1) {
        setRemote([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const found = await search(q, controller.signal);
        setRemote(found.filter((p) => !excluded.has(p.id)));
        setActiveIndex(0);
        setOpen(true);
      } catch {
        // Aborted or offline — keep the previous suggestions.
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, search, selected, excluded]);

  // Close when clicking outside.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function commit(person: PersonOption) {
    setSelected(clearOnSelect ? null : person);
    setQuery(clearOnSelect ? "" : displayNameSurnameFirst(person));
    setOpen(false);
    setActiveIndex(0);
    onSelect?.(person);
    if (clearOnSelect) inputRef.current?.focus();
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (results.length === 0) return;
      setActiveIndex((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + results.length) % results.length;
      });
      return;
    }
    if (e.key === "Enter") {
      if (open && results[activeIndex]) {
        // Don't submit the surrounding form when picking a suggestion.
        e.preventDefault();
        commit(results[activeIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {name && (
        <input type="hidden" name={name} value={selected?.id ?? ""} />
      )}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-input bg-surface px-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          size === "lg" ? "h-12 px-3.5" : "h-9",
          selected && "border-brand/40",
        )}
      >
        {selected ? (
          <Check
            className={cn(
              "shrink-0 text-brand",
              size === "lg" ? "h-5 w-5" : "h-4 w-4",
            )}
            aria-hidden
          />
        ) : (
          <Search
            className={cn(
              "shrink-0 text-muted-foreground",
              size === "lg" ? "h-5 w-5" : "h-4 w-4",
            )}
            aria-hidden
          />
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[activeIndex]
              ? `${listboxId}-${results[activeIndex].id}`
              : undefined
          }
          autoComplete="off"
          autoFocus={autoFocus}
          required={required && !selected}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Free text that matches nobody is discarded, so the visible
            // value and the submitted id can never disagree.
            setQuery(selected ? displayNameSurnameFirst(selected) : "");
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground",
            size === "lg" ? "text-base" : "text-sm",
            inputClassName,
          )}
        />
        {loading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        {(query || selected) && !loading && (
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer la sélection"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 top-full left-0 right-0 mt-1.5 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              {loading ? "Recherche…" : emptyMessage}
            </li>
          ) : (
            results.map((p, i) => {
              const years = lifespan(p);
              return (
                <li
                  key={p.id}
                  id={`${listboxId}-${p.id}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(p);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm",
                    i === activeIndex && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        p.sex === "MALE"
                          ? "bg-male"
                          : p.sex === "FEMALE"
                            ? "bg-female"
                            : "bg-muted-foreground/50",
                      )}
                    />
                    <span className="truncate font-medium">
                      {displayNameSurnameFirst(p)}
                    </span>
                    {p.nickname && (
                      <span className="truncate text-xs text-muted-foreground">
                        «&nbsp;{p.nickname}&nbsp;»
                      </span>
                    )}
                  </span>
                  {years && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {years}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
