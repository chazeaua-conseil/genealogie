import { prisma } from "@/lib/prisma";

export type PersonNode = {
  id: string;
  givenName: string | null;
  surname: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  isLiving: boolean;
  birthYear: number | null;
  deathYear: number | null;
};

/** One box of the pedigree grid — empty when the ancestor is unknown. */
export type Slot = { person: PersonNode | null };

const yearOf = (d: Date | null | undefined) => (d ? d.getFullYear() : null);

export async function loadPersonNode(id: string): Promise<PersonNode | null> {
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
  return {
    id: p.id,
    givenName: p.givenName,
    surname: p.surname,
    sex: p.sex,
    isLiving: p.isLiving,
    birthYear: yearOf(p.events.find((e) => e.type === "BIRTH")?.date),
    deathYear: yearOf(p.events.find((e) => e.type === "DEATH")?.date),
  };
}

/**
 * Ascendant pedigree as a layered array: layer 0 is the focal person, layer
 * g holds 2^g slots (father/mother pairs of the previous layer, in order),
 * with `null` wherever the ancestor is unknown.
 */
export async function loadAncestors(
  rootId: string,
  depth: number,
): Promise<Slot[][]> {
  const layers: Slot[][] = [];
  const root = await loadPersonNode(rootId);
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
        fc?.family?.spouseAId ? loadPersonNode(fc.family.spouseAId) : null,
        fc?.family?.spouseBId ? loadPersonNode(fc.family.spouseBId) : null,
      ]);
      // Keep the father on top when the sexes are known, so the chart reads
      // the same way for every branch.
      const swap = a?.sex === "FEMALE" && b?.sex === "MALE";
      current.push(
        { person: swap ? b : a },
        { person: swap ? a : b },
      );
    }
    layers.push(current);
  }

  return layers;
}

/** Brothers and sisters, from the focal person's family of birth. */
export async function loadSiblings(personId: string): Promise<PersonNode[]> {
  const fc = await prisma.familyChild.findFirst({
    where: { childId: personId },
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

  return (fc?.family.children ?? [])
    .filter((link) => link.childId !== personId)
    .map((link) => ({
      id: link.child.id,
      givenName: link.child.givenName,
      surname: link.child.surname,
      sex: link.child.sex,
      isLiving: link.child.isLiving,
      birthYear: yearOf(link.child.events.find((e) => e.type === "BIRTH")?.date),
      deathYear: yearOf(link.child.events.find((e) => e.type === "DEATH")?.date),
    }))
    .sort((a, b) => (a.birthYear ?? Infinity) - (b.birthYear ?? Infinity));
}
