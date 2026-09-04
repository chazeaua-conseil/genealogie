import Link from "next/link";
import { Pencil } from "lucide-react";
import { requirePersonForCurrentUser } from "@/lib/access";
import { loadAncestors, loadSiblings } from "@/lib/ancestors";
import { displayName, displayNameSurnameFirst, lifespan } from "@/lib/person-display";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PedigreeChart, PedigreeLegend } from "@/components/pedigree-chart";

const GENERATION_CHOICES = [3, 4, 5] as const;
const DEFAULT_GENERATIONS = 4;

export default async function TreePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const { id } = await params;
  const { g } = await searchParams;
  const { person } = await requirePersonForCurrentUser(id);

  const generations =
    GENERATION_CHOICES.find((n) => n === Number(g)) ?? DEFAULT_GENERATIONS;

  const [layers, siblings] = await Promise.all([
    loadAncestors(person.id, generations),
    loadSiblings(person.id),
  ]);

  const knownAncestors = layers
    .slice(1)
    .flat()
    .filter((s) => s.person).length;
  const maxAncestors = 2 ** (generations + 1) - 2;
  const hasBothParents = layers[1].every((s) => s.person);

  return (
    <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <PageHeader
        backHref={`/?person=${person.id}`}
        backLabel="Retour à la recherche"
        eyebrow="Arbre ascendant"
        title={displayName(person)}
        description={`${knownAncestors} ancêtre${knownAncestors > 1 ? "s" : ""} connu${knownAncestors > 1 ? "s" : ""} sur ${maxAncestors} possibles à ${generations} générations. Clique sur une carte pour recentrer l'arbre.`}
        actions={
          <>
            <div className="inline-flex rounded-lg border bg-surface p-0.5">
              {GENERATION_CHOICES.map((n) => (
                <Link
                  key={n}
                  href={`/persons/${person.id}/tree?g=${n}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    n === generations
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title={`${n} générations`}
                >
                  {n} gén.
                </Link>
              ))}
            </div>
            <Link
              href={`/persons/${person.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="h-4 w-4" />
              Modifier la fiche
            </Link>
          </>
        }
      />

      {siblings.length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Frères et sœurs ({siblings.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/persons/${s.id}/tree?g=${generations}`}
                className={cn(
                  "flex flex-col rounded-lg border border-l-4 bg-surface px-3 py-1.5 hover:border-brand/40 hover:bg-accent/40 transition-colors min-w-0",
                  s.sex === "MALE"
                    ? "border-l-male"
                    : s.sex === "FEMALE"
                      ? "border-l-female"
                      : "border-l-muted-foreground/40",
                )}
              >
                <span className="font-medium text-sm truncate max-w-[14rem]">
                  {displayNameSurnameFirst(s)}
                </span>
                {lifespan(s) && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {lifespan(s)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <PedigreeLegend
        addParentHref={
          hasBothParents ? undefined : `/persons/${person.id}/edit#parents`
        }
      />
      <PedigreeChart
        layers={layers}
        generations={generations}
        focusHref={(pid) => `/persons/${pid}/tree?g=${generations}`}
      />
    </main>
  );
}
