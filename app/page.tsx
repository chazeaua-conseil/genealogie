import Link from "next/link";
import {
  ArrowRight,
  LayoutGrid,
  Map,
  Network,
  Pencil,
  Plus,
  ShieldCheck,
  TreeDeciduous,
  Upload,
  Users,
} from "lucide-react";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { loadAncestors, loadSiblings } from "@/lib/ancestors";
import { toPersonOption } from "@/lib/person-options";
import { displayName, displayNameSurnameFirst, lifespan } from "@/lib/person-display";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PedigreeChart, PedigreeLegend } from "@/components/pedigree-chart";
import { GlobalPersonSearch } from "./_components/GlobalPersonSearch";

const GENERATIONS = 3;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return <SignedOutLanding />;

  const tree = await getOrCreateDefaultTree(session.user.id);
  const { person: focusId } = await searchParams;

  const focus = focusId
    ? await prisma.person.findFirst({
        where: { id: focusId, treeId: tree.id },
        select: {
          id: true,
          givenName: true,
          surname: true,
          marriedName: true,
          nickname: true,
          sex: true,
          isLiving: true,
          events: {
            where: { type: { in: ["BIRTH", "DEATH"] } },
            select: { type: true, date: true },
          },
        },
      })
    : null;

  const [personCount, recent] = await Promise.all([
    prisma.person.count({ where: { treeId: tree.id } }),
    focus
      ? Promise.resolve([])
      : prisma.person.findMany({
          where: { treeId: tree.id },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: { id: true, givenName: true, surname: true, sex: true },
        }),
  ]);

  return (
    <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
      <section className="text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
          {tree.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {personCount} personne{personCount > 1 ? "s" : ""} enregistrée
          {personCount > 1 ? "s" : ""} · cherche quelqu&apos;un pour afficher
          son arbre
        </p>

        <div className="mx-auto mt-6 max-w-xl text-left">
          <GlobalPersonSearch
            key={focus?.id ?? "none"}
            defaultPerson={focus ? toPersonOption(focus) : null}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/persons/new"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Plus className="h-4 w-4" />
            Nouvelle personne
          </Link>
          <Link
            href="/persons/bulk"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <LayoutGrid className="h-4 w-4" />
            Saisie multiple
          </Link>
          <Link
            href="/persons/import"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Upload className="h-4 w-4" />
            Importer un CSV
          </Link>
          <Link
            href="/persons"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Liste complète
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {focus ? (
        <FocusedTree focusId={focus.id} />
      ) : (
        <EmptySearchState
          hasPersons={personCount > 0}
          recent={recent}
        />
      )}
    </main>
  );
}

async function FocusedTree({ focusId }: { focusId: string }) {
  const [layers, siblings] = await Promise.all([
    loadAncestors(focusId, GENERATIONS),
    loadSiblings(focusId),
  ]);
  const person = layers[0][0].person;
  if (!person) return null;

  const parents = layers[1].filter((s) => s.person).length;
  const years = lifespan(person);

  return (
    <section className="mt-10 sm:mt-12 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Arbre de {displayName(person)}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ascendance sur {GENERATIONS} générations
            {years ? ` · ${years}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/persons/${person.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil className="h-4 w-4" />
            Fiche
          </Link>
          <Link
            href={`/persons/${person.id}/tree`}
            className={buttonVariants({ size: "sm" })}
          >
            <Network className="h-4 w-4" />
            Arbre détaillé
          </Link>
        </div>
      </div>

      <PedigreeLegend
        addParentHref={
          parents < 2 ? `/persons/${person.id}/edit#parents` : undefined
        }
      />
      <PedigreeChart
        layers={layers}
        generations={GENERATIONS}
        focusHref={(id) => `/?person=${id}`}
      />

      {siblings.length > 0 && (
        <Card className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Frères et sœurs ({siblings.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/?person=${s.id}`}
                className="rounded-lg border bg-surface px-2.5 py-1.5 text-sm hover:border-brand/40 hover:bg-accent/40 transition-colors"
              >
                {displayNameSurnameFirst(s)}
                {lifespan(s) && (
                  <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                    {lifespan(s)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}

function EmptySearchState({
  hasPersons,
  recent,
}: {
  hasPersons: boolean;
  recent: {
    id: string;
    givenName: string | null;
    surname: string | null;
    sex: "MALE" | "FEMALE" | "UNKNOWN";
  }[];
}) {
  if (!hasPersons) {
    return (
      <div className="mt-12 rounded-xl border border-dashed bg-card/50 p-12 text-center">
        <TreeDeciduous className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
        <p className="text-sm text-muted-foreground mb-4">
          L&apos;arbre est vide pour l&apos;instant.
        </p>
        <Link href="/persons/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" />
          Créer la première personne
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center mb-3">
        Modifiées récemment
      </h2>
      <div className="flex flex-wrap justify-center gap-2">
        {recent.map((p) => (
          <Link
            key={p.id}
            href={`/?person=${p.id}`}
            className="inline-flex items-center gap-2 rounded-lg border bg-surface px-3 py-1.5 text-sm hover:border-brand/40 hover:bg-accent/40 transition-colors"
          >
            <span
              aria-hidden
              className={
                "h-1.5 w-1.5 rounded-full " +
                (p.sex === "MALE"
                  ? "bg-male"
                  : p.sex === "FEMALE"
                    ? "bg-female"
                    : "bg-muted-foreground/50")
              }
            />
            {displayNameSurnameFirst(p)}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SignedOutLanding() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <section className="text-center max-w-2xl">
        <div className="inline-flex items-center justify-center rounded-2xl bg-brand-subtle p-4 mb-6">
          <TreeDeciduous className="h-9 w-9 text-accent-foreground" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4 text-balance">
          Généalogie Chazeau
        </h1>
        <p className="text-lg text-muted-foreground mb-10 text-pretty">
          Outil familial pour structurer et visualiser nos arbres
          généalogiques. <span className="text-foreground/80">Accès privé.</span>
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" size="lg">
            Se connecter avec Google
          </Button>
        </form>
      </section>

      <section className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl w-full">
        <Feature
          icon={Users}
          title="Personnes & familles"
          description="Identités, dates et lieux pour chaque ancêtre, saisis en français."
        />
        <Feature
          icon={Map}
          title="Lieux normalisés"
          description="Autocomplétion mondiale via OpenStreetMap, pays par pays."
        />
        <Feature
          icon={ShieldCheck}
          title="Sauvegardes quotidiennes"
          description="Une copie horodatée chaque nuit, conservée 30 jours."
        />
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-4 text-left">
      <Icon className="h-5 w-5 text-primary mb-3" />
      <h2 className="font-medium text-sm mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </Card>
  );
}
