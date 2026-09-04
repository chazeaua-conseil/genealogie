import { prisma } from "@/lib/prisma";
import type { PersonOption } from "@/components/person-combobox";

/**
 * Loads the pool of persons that feeds the type-ahead pickers (parents,
 * partner, children). Birth / death years travel with each option so
 * homonyms stay distinguishable in the suggestion list.
 */
export async function loadPersonOptions(
  treeId: string,
  options: { excludeId?: string } = {},
): Promise<PersonOption[]> {
  const persons = await prisma.person.findMany({
    where: {
      treeId,
      ...(options.excludeId ? { NOT: { id: options.excludeId } } : {}),
    },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
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
  });

  return persons.map(toPersonOption);
}

type PersonWithEvents = {
  id: string;
  givenName: string | null;
  surname: string | null;
  marriedName?: string | null;
  nickname?: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  isLiving: boolean;
  events: { type: string; date: Date | null }[];
};

export function toPersonOption(p: PersonWithEvents): PersonOption {
  const birth = p.events.find((e) => e.type === "BIRTH");
  const death = p.events.find((e) => e.type === "DEATH");
  return {
    id: p.id,
    givenName: p.givenName,
    surname: p.surname,
    marriedName: p.marriedName ?? null,
    nickname: p.nickname ?? null,
    sex: p.sex,
    isLiving: p.isLiving,
    birthYear: birth?.date?.getFullYear() ?? null,
    deathYear: death?.date?.getFullYear() ?? null,
  };
}
