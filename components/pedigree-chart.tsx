import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Slot } from "@/lib/ancestors";
import { displayNameSurnameFirst, lifespan } from "@/lib/person-display";

// Fixed geometry so the SVG connector endpoints are deterministic.
const COL_W = 208;
const COL_GAP = 52;
const ROW_H = 62;
const ROW_GAP = 8;
const PADDING = 10;

type Geometry = {
  generations: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
};

function geometry(generations: number): Geometry {
  const cols = generations + 1;
  const rows = 2 ** generations;
  return {
    generations,
    cols,
    rows,
    width: cols * COL_W + (cols - 1) * COL_GAP + 2 * PADDING,
    height: rows * ROW_H + (rows - 1) * ROW_GAP + 2 * PADDING,
  };
}

function boxPosition(g: Geometry, col: number, idx: number) {
  const span = g.rows / 2 ** col;
  const x = PADDING + col * (COL_W + COL_GAP);
  const y = PADDING + idx * span * (ROW_H + ROW_GAP);
  const h = span * ROW_H + (span - 1) * ROW_GAP;
  return { x, y, w: COL_W, h, left: x, right: x + COL_W, cy: y + h / 2 };
}

type LinePath = { d: string; kind: "parent-child" | "marriage" };

function computeLines(layers: Slot[][], g: Geometry): LinePath[] {
  const paths: LinePath[] = [];

  for (let gen = 0; gen < g.generations; gen++) {
    for (let i = 0; i < 2 ** gen; i++) {
      const childSlot = layers[gen]?.[i];
      const parentASlot = layers[gen + 1]?.[i * 2];
      const parentBSlot = layers[gen + 1]?.[i * 2 + 1];

      const child = boxPosition(g, gen, i);
      const parentA = boxPosition(g, gen + 1, i * 2);
      const parentB = boxPosition(g, gen + 1, i * 2 + 1);

      const hasChild = Boolean(childSlot?.person);
      const hasA = Boolean(parentASlot?.person);
      const hasB = Boolean(parentBSlot?.person);

      // Vertical "union" rail sitting between the two columns.
      const railX = parentA.left - COL_GAP / 2;

      if (hasA && hasB) {
        paths.push({
          d: `M ${railX} ${parentA.cy} L ${railX} ${parentB.cy}`,
          kind: "marriage",
        });
      }
      if (!hasChild) continue;
      if (hasA) {
        paths.push({
          d: `M ${parentA.left} ${parentA.cy} L ${railX} ${parentA.cy}`,
          kind: "parent-child",
        });
      }
      if (hasB) {
        paths.push({
          d: `M ${parentB.left} ${parentB.cy} L ${railX} ${parentB.cy}`,
          kind: "parent-child",
        });
      }
      if (hasA || hasB) {
        const railMidY =
          hasA && hasB
            ? (parentA.cy + parentB.cy) / 2
            : hasA
              ? parentA.cy
              : parentB.cy;
        paths.push({
          d: `M ${railX} ${railMidY} L ${child.right} ${railMidY} L ${child.right} ${child.cy}`,
          kind: "parent-child",
        });
      }
    }
  }
  return paths;
}

/**
 * Ascendant pedigree: the focal person on the left, each generation of
 * ancestors to the right. Rendered as absolutely positioned cards over an
 * SVG connector layer, inside a horizontally pannable canvas.
 */
export function PedigreeChart({
  layers,
  generations,
  focusHref,
}: {
  layers: Slot[][];
  generations: number;
  /** Link target for each card; defaults to the person's own tree view. */
  focusHref?: (id: string) => string;
}) {
  const g = geometry(generations);
  const lines = computeLines(layers, g);
  const href = focusHref ?? ((id: string) => `/persons/${id}/tree`);

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm overflow-x-auto scrollbar-slim">
      <div className="relative" style={{ width: g.width, height: g.height }}>
        <svg
          width={g.width}
          height={g.height}
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
              stroke={p.kind === "marriage" ? "var(--female)" : "var(--input)"}
              strokeWidth={p.kind === "marriage" ? 2.5 : 1.5}
            />
          ))}
        </svg>

        {layers.flatMap((slots, generation) =>
          slots.map((slot, index) => {
            const pos = boxPosition(g, generation, index);
            return (
              <PedigreeCard
                key={`${generation}-${index}`}
                slot={slot}
                generation={generation}
                href={href}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.cy - ROW_H / 2,
                  width: pos.w,
                  height: ROW_H,
                }}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

function PedigreeCard({
  slot,
  generation,
  href,
  style,
}: {
  slot: Slot;
  generation: number;
  href: (id: string) => string;
  style: React.CSSProperties;
}) {
  const base =
    "rounded-lg border px-3 py-2 text-sm flex flex-col justify-center overflow-hidden";

  if (!slot.person) {
    return (
      <div
        style={style}
        className={cn(
          base,
          "border-dashed bg-background/40 text-muted-foreground",
        )}
      >
        <span className="text-xs italic">Ancêtre inconnu</span>
        {generation > 0 && (
          <span className="text-[10px] mt-0.5 opacity-70">
            Génération {generation}
          </span>
        )}
      </div>
    );
  }

  const p = slot.person;
  const years = lifespan(p);
  const accent =
    p.sex === "MALE"
      ? "border-l-male"
      : p.sex === "FEMALE"
        ? "border-l-female"
        : "border-l-muted-foreground/40";

  return (
    <Link
      href={href(p.id)}
      style={style}
      className={cn(
        base,
        "border-l-4 bg-surface hover:border-brand/40 hover:bg-accent/40 hover:shadow-sm transition-all",
        accent,
      )}
    >
      <span className="font-medium truncate">{displayNameSurnameFirst(p)}</span>
      {years && (
        <span className="text-xs text-muted-foreground mt-0.5 truncate tabular-nums">
          {years}
        </span>
      )}
    </Link>
  );
}

export function PedigreeLegend({ addParentHref }: { addParentHref?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-px w-5 bg-input" />
        Filiation
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-0.5 bg-female" />
        Union
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-male" />
        Masculin
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-female" />
        Féminin
      </span>
      {addParentHref && (
        <Link
          href={addParentHref}
          className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un parent
        </Link>
      )}
    </div>
  );
}
