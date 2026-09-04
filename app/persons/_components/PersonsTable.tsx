"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Network, Search, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  displayNameSurnameFirst,
  groupBySurname,
  normalizeSearch,
  personSearchKey,
  NO_SURNAME_KEY,
} from "@/lib/person-display";
import { Badge } from "@/components/ui/badge";

type RowEvent = {
  date: Date | null;
  place: { name: string } | null;
};

export type PersonRow = {
  id: string;
  givenName: string | null;
  surname: string | null;
  marriedName: string | null;
  nickname: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  isLiving: boolean;
  birth: RowEvent | null;
  death: RowEvent | null;
};

const sexConfig: Record<
  PersonRow["sex"],
  { label: string; variant: "male" | "female" | "neutral" }
> = {
  MALE: { label: "Masculin", variant: "male" },
  FEMALE: { label: "Féminin", variant: "female" },
  UNKNOWN: { label: "Inconnu", variant: "neutral" },
};

function initials(p: { givenName: string | null; surname: string | null }) {
  const a = p.givenName?.trim()?.[0] ?? "";
  const b = p.surname?.trim()?.[0] ?? "";
  return ((a + b).toUpperCase() || "?").slice(0, 2);
}

function formatFrDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR").format(d);
}

function ageInYears(from: Date, to: Date): number {
  let age = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) {
    age--;
  }
  return age;
}

function computeAge(p: PersonRow, today: Date): number | null {
  const birth = p.birth?.date;
  if (!birth) return null;
  const reference = p.isLiving ? today : p.death?.date;
  if (!reference) return null;
  const age = ageInYears(new Date(birth), new Date(reference));
  if (age < 0 || age > 130) return null; // sanity guard against bad data
  return age;
}

export function PersonsTable({ persons }: { persons: PersonRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return persons;
    const q = normalizeSearch(query.trim());
    return persons.filter((p) => personSearchKey(p).includes(q));
  }, [persons, query]);

  const grouped = useMemo(() => groupBySurname(filtered), [filtered]);

  // Today reference for age computation — fixed for the lifetime of the
  // mounted list, which is re-rendered on every page visit anyway.
  const today = useMemo(() => new Date(), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 transition-colors">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par nom, prénoms, nom marital, surnom…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Rechercher une personne"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs text-muted-foreground border-l pl-3 ml-1 whitespace-nowrap">
          {filtered.length} / {persons.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Aucune personne ne correspond à «&nbsp;{query}&nbsp;».
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne</TableHead>
                <TableHead className="w-28">Sexe</TableHead>
                <TableHead>Naissance</TableHead>
                <TableHead>Décès</TableHead>
                <TableHead className="w-20">Âge</TableHead>
                <TableHead className="w-16 text-right">Arbre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map(([surname, group]) => (
                <Fragment key={surname}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={6}
                      className="py-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground"
                    >
                      {surname === NO_SURNAME_KEY.toUpperCase()
                        ? NO_SURNAME_KEY
                        : surname}
                      <span className="ml-2 text-muted-foreground/70 font-normal normal-case">
                        ({group.length})
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell>
                        <Link
                          href={`/persons/${p.id}/edit`}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs font-medium">
                              {initials(p)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate group-hover:text-primary transition-colors">
                              {displayNameSurnameFirst(p)}
                            </div>
                            {p.nickname && (
                              <div className="text-xs text-muted-foreground truncate">
                                «&nbsp;{p.nickname}&nbsp;»
                              </div>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SexBadge sex={p.sex} />
                      </TableCell>
                      <TableCell>
                        <EventCell event={p.birth} />
                      </TableCell>
                      <TableCell>
                        <EventCell event={p.death} emptyAsBlank />
                      </TableCell>
                      <TableCell>
                        <AgeCell person={p} today={today} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/persons/${p.id}/tree`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title={`Voir l'arbre de ${displayNameSurnameFirst(p)}`}
                        >
                          <Network className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SexBadge({ sex }: { sex: PersonRow["sex"] }) {
  const c = sexConfig[sex];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function AgeCell({ person, today }: { person: PersonRow; today: Date }) {
  const age = computeAge(person, today);
  if (age === null) return <span />;
  return (
    <span
      className="text-sm tabular-nums"
      title={
        person.isLiving
          ? `Calculé à partir d'aujourd'hui (${formatFrDate(today)})`
          : "Calculé entre la naissance et le décès"
      }
    >
      {age}{" "}
      <span className="text-xs text-muted-foreground">
        {age > 1 ? "ans" : "an"}
      </span>
    </span>
  );
}

function EventCell({
  event,
  emptyAsBlank = false,
}: {
  event: RowEvent | null;
  emptyAsBlank?: boolean;
}) {
  if (!event || (!event.date && !event.place)) {
    return emptyAsBlank ? (
      <span />
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }
  return (
    <div className="leading-tight">
      {event.date && (
        <div className="text-sm">{formatFrDate(event.date)}</div>
      )}
      {event.place && (
        <div className="text-xs text-muted-foreground truncate max-w-[16rem]">
          {event.place.name}
        </div>
      )}
    </div>
  );
}

