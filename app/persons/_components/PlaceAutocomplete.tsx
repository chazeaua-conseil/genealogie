"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type PlaceSuggestion = {
  displayName: string;
  name: string;
  department: string | null;
  region: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
};

/**
 * Commune autocomplete backed by Nominatim. Filters by `countryCode` (ISO
 * alpha-2 lowercase). On selection, fills hidden inputs that carry the
 * structured data the Server Action uses to enrich the Place row.
 */
export function PlaceAutocomplete({
  fieldPrefix,
  defaultValue = "",
  countryCode,
}: {
  fieldPrefix: string;
  defaultValue?: string;
  countryCode: string;
}) {
  const [text, setText] = useState(defaultValue);
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlaceSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  // Clear selection if country changes — the chosen suggestion is no longer
  // necessarily valid for the new country.
  useEffect(() => {
    setSelected(null);
  }, [countryCode]);

  useEffect(() => {
    if (selected && selected.displayName === text) {
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text || text.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (inFlightRef.current) inFlightRef.current.abort();
      const ac = new AbortController();
      inFlightRef.current = ac;
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: text });
        if (countryCode) params.set("cc", countryCode);
        const res = await fetch(`/api/places/search?${params}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setResults([]);
          setOpen(false);
          return;
        }
        const data: PlaceSuggestion[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        // aborted or network error — ignored
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, selected, countryCode]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function onSelect(s: PlaceSuggestion) {
    setSelected(s);
    setText(s.displayName);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        name={`${fieldPrefix}.placeText`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSelected(null);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder="Commune, ville…"
        autoComplete="off"
      />
      {/* Structured data — only sent when a suggestion was picked. */}
      <input
        type="hidden"
        name={`${fieldPrefix}.placeName`}
        value={selected?.name ?? ""}
      />
      <input
        type="hidden"
        name={`${fieldPrefix}.placeDepartment`}
        value={selected?.department ?? ""}
      />
      <input
        type="hidden"
        name={`${fieldPrefix}.placeRegion`}
        value={selected?.region ?? ""}
      />
      <input
        type="hidden"
        name={`${fieldPrefix}.placeCountry`}
        value={selected?.country ?? ""}
      />
      <input
        type="hidden"
        name={`${fieldPrefix}.placeLatitude`}
        value={selected?.latitude?.toString() ?? ""}
      />
      <input
        type="hidden"
        name={`${fieldPrefix}.placeLongitude`}
        value={selected?.longitude?.toString() ?? ""}
      />

      {loading && (
        <p className="absolute right-3 top-2 text-xs text-muted-foreground">
          …
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-10 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {results.map((r, i) => (
            <li
              key={`${r.latitude}-${r.longitude}-${i}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(r);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">
                {r.displayName}
              </div>
            </li>
          ))}
          <li className="px-3 py-1.5 text-xs text-muted-foreground border-t">
            Données © OpenStreetMap contributors
          </li>
        </ul>
      )}
    </div>
  );
}
