import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import { buttonVariants } from "@/components/ui/button";
import {
  displayName as displayNameNatural,
  displayNameSurnameFirst,
} from "@/lib/person-display";

const ANCESTOR_GENERATIONS = 3;

// Fixed dimensions so SVG line endpoints are deterministic.
const COL_W = 220;
const COL_GAP = 56;
const ROW_H = 64;
const ROW_GAP = 8;
const PADDING = 8;
const TOTAL_COLS = ANCESTOR_GENERATIONS + 1;
const TOTAL_ROWS = 2 ** ANCESTOR_GENERATIONS;
const TOTAL_W =
  TOTAL_COLS * COL_W + (TOTAL_COLS - 1) * COL_GAP + 2 * PADDING;
const TOTAL_H =
  TOTAL_ROWS * ROW_H + (TOTAL_ROWS - 1) * ROW_GAP + 2 * PADDING;

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

const displayName = displayNameNatural;

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

async function loadAncestors(
  rootId: string,
  depth: number,
): Promise<Slot[][]> {
  const layers: Slot[][] = [];
  const root = await loadPerson(rootId);
  layers.push([{ person: root }]);

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

function boxPosition(col0: number, idx: number) {
  const span = TOTAL_ROWS / 2 ** col0;
  const row0 = idx * span;
  const x = PADDING + col0 * (COL_W + COL_GAP);
  const y = PADDING + row0 * (ROW_H + ROW_GAP);
  const w = COL_W;
  const h = span * ROW_H + (span - 1) * ROW_GAP;
  return {
    x,
    y,
    w,
    h,
    left: x,
    right: x + w,
    cy: y + h / 2,
  };
}

type LinePath = {
  d: string;
  kind: "parent-child" | "marriage";
  title: string;
};

function computeLines(layers: Slot[][]): LinePath[] {
  const paths: LinePath[] = [];

  for (let g = 0; g < ANCESTOR_GENERATIONS; g++) {
    const childCount = 2 ** g;
    for (let i = 0; i < childCount; i++) {
      const childSlot = layers[g][i];
      const parentASlot = layers[g + 1][i * 2];
      const parentBSlot = layers[g + 1][i * 2 + 1];

      const child = boxPosition(g, i);
      const parentA = boxPosition(g + 1, i * 2);
      const parentB = boxPosition(g + 1, i * 2 + 1);

      const hasChild = childSlot.person != null;
      const hasParentA = parentASlot.person != null;
      const hasParentB = parentBSlot.person != null;

      // Vertical "marriage" rail at left of the parents column.
      const railX = parentA.left - COL_GAP / 2;

      if (hasParentA && hasParentB) {
        paths.push({
          d: `M ${railX} ${parentA.cy} L ${railX} ${parentB.cy}`,
          kind: "marriage",
          title: "Union",
        });
      }

      if (!hasChild) continue;

      // From parent A → rail
      if (hasParentA) {
        paths.push({
          d: `M ${parentA.left} ${parentA.cy} L ${railX} ${parentA.cy}`,
          kind: "parent-child",
          title: "Filiation",
        });
      }
      // From parent B → rail
      if (hasParentB) {
        paths.push({
          d: `M ${parentB.left} ${parentB.cy} L ${railX} ${parentB.cy}`,
          kind: "parent-child",
          title: "Filiation",
        });
      }
      // From rail midpoint → child right
      if (hasParentA || hasParentB) {
        const railMidY =
          hasParentA && hasParentB
            ? (parentA.cy + parentB.cy) / 2
            : hasParentA
              ? parentA.cy
              : parentB.cy;
        paths.push({
          d: `M ${railX} ${railMidY} L ${child.right} ${railMidY} L ${child.right} ${child.cy}`,
          kind: "parent-child",
          title: "Filiation",
        });
      }
    }
  }
  return paths;
}

export default async function TreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { person } = await requirePersonForCurrentUser(id);

  const layers = await loadAncestors(person.id, ANCESTOR_GENERATIONS);
  const lines = computeLines(layers);

  // Siblings of the focal person (1 level).
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
                    {displayNameSurnameFirst(s)}
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

      <Legend />

      <div className="overflow-x-auto rounded-lg border bg-card p-3 shadow-sm">
        <div
          className="relative"
          style={{ width: TOTAL_W, height: TOTAL_H }}
        >
          <svg
            width={TOTAL_W}
            height={TOTAL_H}
            className="absolute inset-0 pointer-events-none"
            aria-hidden
          >
            {lines.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke={p.kind === "marriage" ? "#ec4899" : "#94a3b8"}
                strokeWidth={p.kind === "marriage" ? 2.5 : 1.5}
              >
                <title>{p.title}</title>
              </path>
            ))}
          </svg>

          {layers.flatMap((slots, generation) =>
            slots.map((slot, index) => {
              const pos = boxPosition(generation, index);
              return (
                <TreeCard
                  key={`${generation}-${index}`}
                  slot={slot}
                  generation={generation}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: pos.w,
                    height: pos.h,
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

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden>
          <line
            x1="0"
            y1="3"
            x2="22"
            y2="3"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
        </svg>
        Filiation
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="6" height="22" aria-hidden>
          <line
            x1="3"
            y1="0"
            x2="3"
            y2="22"
            stroke="#ec4899"
            strokeWidth="2.5"
          />
        </svg>
        Union
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
        Masculin
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-pink-400" />
        Féminin
      </span>
    </div>
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
  const base =
    "rounded-md border bg-background p-3 text-sm flex flex-col justify-center";

  if (!slot.person) {
    return (
      <div
        style={style}
        className={`${base} border-dashed text-muted-foreground italic`}
      >
        <span className="text-xs">Inconnu</span>
        {generation > 0 && (
          <span className="text-[10px] mt-0.5">Niveau {generation}</span>
        )}
      </div>
    );
  }

  const p = slot.person;
  const lifespan =
    p.birthYear || p.deathYear
      ? `${p.birthYear ?? "?"} – ${p.isLiving ? "" : (p.deathYear ?? "?")}`
      : null;
  const sexBorder =
    p.sex === "MALE"
      ? "border-l-blue-400"
      : p.sex === "FEMALE"
        ? "border-l-pink-400"
        : "border-l-muted-foreground";

  return (
    <Link
      href={`/persons/${p.id}/tree`}
      style={style}
      className={`${base} border-l-4 ${sexBorder} hover:bg-muted/50 transition-colors`}
    >
      <div className="font-medium truncate">{displayNameSurnameFirst(p)}</div>
      {lifespan && (
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {lifespan}
        </div>
      )}
    </Link>
  );
}
