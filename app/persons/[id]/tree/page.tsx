import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import { buttonVariants } from "@/components/ui/button";

const ANCESTOR_GENERATIONS = 3; // root + 3 layers of ancestors

type PersonNode = {
  id: string;
  givenName: string | null;
  surname: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  isLiving: boolean;
  birthYear: number | null;
  deathYear: number | null;
};

type Slot = { person: PersonNode | null };

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

async function loadAncestors(
  rootId: string,
  depth: number,
): Promise<Slot[][]> {
  // Layers indexed by generation. Layer 0 = root. Each subsequent layer
  // doubles in size. Empty parent slots are represented by { person: null }.
  const layers: Slot[][] = [];

  // Layer 0
  const rootPerson = await loadPerson(rootId);
  layers.push([{ person: rootPerson }]);

  for (let g = 1; g <= depth; g++) {
    const previous = layers[g - 1];
    const current: Slot[] = [];
    for (const slot of previous) {
      if (!slot.person) {
        current.push({ person: null }, { person: null });
        continue;
      }
      const fc = await prisma.familyChild.findFirst({
        where: { childId: slot.person.id },
        select: { family: { select: { spouseAId: true, spouseBId: true } } },
      });
      const [a, b] = await Promise.all([
        fc?.family?.spouseAId ? loadPerson(fc.family.spouseAId) : null,
        fc?.family?.spouseBId ? loadPerson(fc.family.spouseBId) : null,
      ]);
      current.push({ person: a }, { person: b });
    }
    layers.push(current);
  }

  return layers;
}

async function loadPerson(id: string): Promise<PersonNode | null> {
  const p = await prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      givenName: true,
      surname: true,
      sex: true,
      isLiving: true,
      events: {
        where: { type: { in: ["BIRTH", "DEATH"] } },
        select: { type: true, date: true },
      },
    },
  });
  if (!p) return null;
  const birth = p.events.find((e) => e.type === "BIRTH");
  const death = p.events.find((e) => e.type === "DEATH");
  return {
    id: p.id,
    givenName: p.givenName,
    surname: p.surname,
    sex: p.sex,
    isLiving: p.isLiving,
    birthYear: birth?.date ? birth.date.getFullYear() : null,
    deathYear: death?.date ? death.date.getFullYear() : null,
  };
}

export default async function TreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { person } = await requirePersonForCurrentUser(id);

  const layers = await loadAncestors(person.id, ANCESTOR_GENERATIONS);
  const rowsTotal = 2 ** ANCESTOR_GENERATIONS; // 8 rows for 3 generations

  // Siblings — children of the same family of birth, excluding the focal person.
  const familyChild = await prisma.familyChild.findFirst({
    where: { childId: person.id },
    include: {
      family: {
        include: {
          children: {
            include: {
              child: {
                include: {
                  events: {
                    where: { type: { in: ["BIRTH", "DEATH"] } },
                    select: { type: true, date: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const siblings = (familyChild?.family.children ?? [])
    .filter((fc) => fc.childId !== person.id)
    .map((fc) => {
      const birth = fc.child.events.find((e) => e.type === "BIRTH");
      const death = fc.child.events.find((e) => e.type === "DEATH");
      return {
        id: fc.child.id,
        givenName: fc.child.givenName,
        surname: fc.child.surname,
        sex: fc.child.sex,
        isLiving: fc.child.isLiving,
        birthYear: birth?.date ? birth.date.getFullYear() : null,
        deathYear: death?.date ? death.date.getFullYear() : null,
      };
    })
    .sort(
      (a, b) => (a.birthYear ?? Infinity) - (b.birthYear ?? Infinity),
    );

  return (
    <main className="container mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/persons"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Retour à la liste
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">
            Arbre de {displayName(person)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Pedigree ascendant sur {ANCESTOR_GENERATIONS} générations (
            {2 ** ANCESTOR_GENERATIONS} ancêtres au maximum). Clique sur un
            ancêtre pour explorer son arbre.
          </p>
        </div>
        <Link
          href={`/persons/${person.id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Modifier
        </Link>
      </header>

      {siblings.length > 0 && (
        <section className="mb-8 rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Frères et sœurs ({siblings.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => {
              const lifespan =
                s.birthYear || s.deathYear
                  ? `${s.birthYear ?? "?"} – ${
                      s.isLiving ? "" : (s.deathYear ?? "?")
                    }`
                  : null;
              const sexColor =
                s.sex === "MALE"
                  ? "border-l-blue-400"
                  : s.sex === "FEMALE"
                    ? "border-l-pink-400"
                    : "border-l-muted-foreground";
              return (
                <Link
                  key={s.id}
                  href={`/persons/${s.id}/tree`}
                  className={`flex flex-col rounded-md border border-l-4 ${sexColor} bg-background px-3 py-2 hover:bg-muted/50 transition-colors min-w-0`}
                >
                  <span className="font-medium text-sm truncate max-w-[14rem]">
                    {displayName(s)}
                  </span>
                  {lifespan && (
                    <span className="text-xs text-muted-foreground">
                      {lifespan}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="overflow-x-auto">
        <div
          className="grid gap-3 min-w-[960px]"
          style={{
            gridTemplateColumns: `repeat(${ANCESTOR_GENERATIONS + 1}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rowsTotal}, minmax(72px, auto))`,
          }}
        >
          {layers.flatMap((slots, generation) =>
            slots.map((slot, index) => {
              const span = rowsTotal / slots.length;
              const rowStart = 1 + index * span;
              return (
                <TreeCard
                  key={`${generation}-${index}`}
                  slot={slot}
                  generation={generation}
                  style={{
                    gridColumnStart: generation + 1,
                    gridRowStart: rowStart,
                    gridRowEnd: `span ${span}`,
                  }}
                />
              );
            }),
          )}
        </div>
      </div>
    </main>
  );
}

function TreeCard({
  slot,
  generation,
  style,
}: {
  slot: Slot;
  generation: number;
  style: React.CSSProperties;
}) {
  const wrapperClass =
    "rounded-md border bg-card p-3 text-sm flex flex-col justify-center self-center w-full";

  if (!slot.person) {
    return (
      <div
        style={style}
        className={`${wrapperClass} border-dashed text-muted-foreground italic`}
      >
        <span className="text-xs">Inconnu</span>
        {generation > 0 && (
          <span className="text-[10px] mt-0.5">
            Niveau {generation}
          </span>
        )}
      </div>
    );
  }

  const p = slot.person;
  const lifespan =
    p.birthYear || p.deathYear
      ? `${p.birthYear ?? "?"} – ${p.isLiving ? "" : (p.deathYear ?? "?")}`
      : null;
  const sexColor =
    p.sex === "MALE"
      ? "border-l-blue-400"
      : p.sex === "FEMALE"
        ? "border-l-pink-400"
        : "border-l-muted-foreground";

  return (
    <Link
      href={`/persons/${p.id}/tree`}
      style={style}
      className={`${wrapperClass} border-l-4 ${sexColor} hover:bg-muted/50 transition-colors`}
    >
      <div className="font-medium truncate">{displayName(p)}</div>
      {lifespan && (
        <div className="text-xs text-muted-foreground mt-0.5">{lifespan}</div>
      )}
    </Link>
  );
}
