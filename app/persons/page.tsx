import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Network } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

function initials(p: { givenName: string | null; surname: string | null }) {
  const a = p.givenName?.trim()?.[0] ?? "";
  const b = p.surname?.trim()?.[0] ?? "";
  const v = (a + b).toUpperCase();
  return v || "?";
}

const sexConfig: Record<
  "MALE" | "FEMALE" | "UNKNOWN",
  { label: string; className: string }
> = {
  MALE: {
    label: "Masculin",
    className:
      "bg-blue-50 text-blue-700 ring-blue-700/15 dark:bg-blue-950/40 dark:text-blue-300",
  },
  FEMALE: {
    label: "Féminin",
    className:
      "bg-pink-50 text-pink-700 ring-pink-700/15 dark:bg-pink-950/40 dark:text-pink-300",
  },
  UNKNOWN: {
    label: "Inconnu",
    className:
      "bg-muted text-muted-foreground ring-foreground/10",
  },
};

function SexBadge({ sex }: { sex: "MALE" | "FEMALE" | "UNKNOWN" }) {
  const c = sexConfig[sex];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

function formatFrDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR").format(d);
}

function EventCell({
  date,
  place,
  emptyAsBlank = false,
}: {
  date: Date | null;
  place: { name: string } | null;
  emptyAsBlank?: boolean;
}) {
  if (!date && !place) {
    return emptyAsBlank ? (
      <span />
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }
  return (
    <div className="leading-tight">
      {date && <div className="text-sm">{formatFrDate(date)}</div>}
      {place && (
        <div className="text-xs text-muted-foreground truncate max-w-[16rem]">
          {place.name}
        </div>
      )}
    </div>
  );
}

export default async function PersonsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const tree = await getOrCreateDefaultTree(session.user.id);
  const persons = await prisma.person.findMany({
    where: { treeId: tree.id },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    include: {
      events: {
        where: { type: { in: ["BIRTH", "DEATH"] } },
        include: { place: { select: { name: true } } },
      },
    },
  });

  return (
    <main className="container mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{tree.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {persons.length} personne{persons.length > 1 ? "s" : ""}{" "}
            enregistrée{persons.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/persons/new"
          className={buttonVariants({ size: "default" })}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvelle personne
        </Link>
      </header>

      {persons.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-16 text-center">
          <p className="text-muted-foreground mb-4">
            Aucune personne dans cet arbre pour le moment.
          </p>
          <Link
            href="/persons/new"
            className={buttonVariants({ variant: "outline" })}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter la première
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne</TableHead>
                <TableHead className="w-28">Sexe</TableHead>
                <TableHead>Naissance</TableHead>
                <TableHead>Décès</TableHead>
                <TableHead className="w-16 text-right">Arbre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {persons.map((p) => {
                const birth = p.events.find((e) => e.type === "BIRTH");
                const death = p.events.find((e) => e.type === "DEATH");
                return (
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
                            {displayName(p)}
                          </div>
                          {p.nickname && (
                            <div className="text-xs text-muted-foreground truncate">
                              « {p.nickname} »
                            </div>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <SexBadge sex={p.sex} />
                    </TableCell>
                    <TableCell>
                      <EventCell
                        date={birth?.date ?? null}
                        place={birth?.place ?? null}
                      />
                    </TableCell>
                    <TableCell>
                      <EventCell
                        date={death?.date ?? null}
                        place={death?.place ?? null}
                        emptyAsBlank
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/persons/${p.id}/tree`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={`Voir l'arbre de ${displayName(p)}`}
                      >
                        <Network className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
