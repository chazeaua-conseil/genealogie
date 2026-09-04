"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PersonCombobox,
  type PersonOption,
} from "@/components/person-combobox";

/**
 * Home-page search field. Queries the whole tree server-side (so it scales
 * past what we would want to ship to the browser) and, on selection, puts
 * the person in the URL — the page then renders their tree underneath.
 */
export function GlobalPersonSearch({
  defaultPerson = null,
}: {
  defaultPerson?: PersonOption | null;
}) {
  const router = useRouter();

  const search = useCallback(
    async (query: string, signal: AbortSignal): Promise<PersonOption[]> => {
      const res = await fetch(
        `/api/persons/search?q=${encodeURIComponent(query)}`,
        { signal },
      );
      if (!res.ok) return [];
      return (await res.json()) as PersonOption[];
    },
    [],
  );

  return (
    <PersonCombobox
      id="global-person-search"
      size="lg"
      search={search}
      defaultPerson={defaultPerson}
      autoFocus={!defaultPerson}
      placeholder="Rechercher une personne dans l'arbre…"
      emptyMessage="Personne trouvée à ce nom"
      onSelect={(p) => router.push(`/?person=${p.id}`)}
    />
  );
}
