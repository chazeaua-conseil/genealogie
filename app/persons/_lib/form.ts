// Shared schema and helpers used by createPerson / updatePerson.
// Imported only from server-side code (Server Actions).

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { countryNameByCode } from "@/lib/countries";

export const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s.length === 0 ? null : s))
    .nullable();

export const optionalFloat = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? null : Number.parseFloat(s)))
  .nullable()
  .refine((n) => n === null || !Number.isNaN(n), {
    message: "invalid number",
  });

export const SexSchema = z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN");

export const EventInputSchema = z.object({
  date: trimmedOptional(20),
  placeText: trimmedOptional(160),
  placeName: trimmedOptional(160),
  placeDepartment: trimmedOptional(100),
  placeRegion: trimmedOptional(100),
  placeCountry: trimmedOptional(100),
  placeCountryCode: trimmedOptional(8),
  placeLatitude: optionalFloat,
  placeLongitude: optionalFloat,
});
export type EventInput = z.infer<typeof EventInputSchema>;

// Empty event input — used to force-delete an existing event server-side
// (e.g. when the user marks the person as living, any death event is wiped).
export const EMPTY_EVENT_INPUT: EventInput = {
  date: null,
  placeText: null,
  placeName: null,
  placeDepartment: null,
  placeRegion: null,
  placeCountry: null,
  placeCountryCode: null,
  placeLatitude: null,
  placeLongitude: null,
};

export const PersonCoreSchema = z.object({
  givenName: trimmedOptional(120),
  surname: trimmedOptional(120),
  marriedName: trimmedOptional(120),
  nickname: trimmedOptional(120),
  sex: SexSchema,
  isLiving: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v === "on"),
  notes: trimmedOptional(5000),
});
export type PersonCore = z.infer<typeof PersonCoreSchema>;

export function readPersonCore(formData: FormData): PersonCore {
  return PersonCoreSchema.parse({
    givenName: formData.get("givenName") ?? "",
    surname: formData.get("surname") ?? "",
    marriedName: formData.get("marriedName") ?? "",
    nickname: formData.get("nickname") ?? "",
    sex: formData.get("sex") ?? "UNKNOWN",
    isLiving: formData.get("isLiving"),
    notes: formData.get("notes") ?? "",
  });
}

export function readEvent(
  prefix: "birth" | "death",
  formData: FormData,
): EventInput {
  return EventInputSchema.parse({
    date: formData.get(`${prefix}.date`) ?? "",
    placeText: formData.get(`${prefix}.placeText`) ?? "",
    placeName: formData.get(`${prefix}.placeName`) ?? "",
    placeDepartment: formData.get(`${prefix}.placeDepartment`) ?? "",
    placeRegion: formData.get(`${prefix}.placeRegion`) ?? "",
    placeCountry: formData.get(`${prefix}.placeCountry`) ?? "",
    placeCountryCode: formData.get(`${prefix}.placeCountryCode`) ?? "",
    placeLatitude: formData.get(`${prefix}.placeLatitude`) ?? "",
    placeLongitude: formData.get(`${prefix}.placeLongitude`) ?? "",
  });
}

export function readParents(formData: FormData): {
  A: string | null;
  B: string | null;
} {
  const a = (formData.get("parentAId") ?? "").toString().trim();
  const b = (formData.get("parentBId") ?? "").toString().trim();
  return { A: a || null, B: b || null };
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getOrCreatePlace(
  treeId: string,
  input: EventInput,
  userId: string,
) {
  const name = input.placeName ?? input.placeText;
  if (!name) return null;

  const country =
    input.placeCountry ?? countryNameByCode(input.placeCountryCode);

  const existing = await prisma.place.findFirst({
    where: { treeId, name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    const enrichments: Record<string, string | number> = {};
    if (input.placeDepartment && !existing.department)
      enrichments.department = input.placeDepartment;
    if (input.placeRegion && !existing.region)
      enrichments.region = input.placeRegion;
    if (country && !existing.country) enrichments.country = country;
    if (input.placeLatitude !== null && existing.latitude === null)
      enrichments.latitude = input.placeLatitude;
    if (input.placeLongitude !== null && existing.longitude === null)
      enrichments.longitude = input.placeLongitude;
    if (Object.keys(enrichments).length > 0) {
      return prisma.place.update({
        where: { id: existing.id },
        data: enrichments,
      });
    }
    return existing;
  }

  return prisma.place.create({
    data: {
      treeId,
      name,
      department: input.placeDepartment,
      region: input.placeRegion,
      country,
      latitude: input.placeLatitude,
      longitude: input.placeLongitude,
      createdById: userId,
    },
  });
}

export async function upsertEvent(
  personId: string,
  treeId: string,
  userId: string,
  type: "BIRTH" | "DEATH",
  input: EventInput,
) {
  const date = parseDate(input.date);
  const placeName = input.placeName ?? input.placeText;
  const hasAnyValue = date !== null || placeName !== null;

  const existing = await prisma.event.findFirst({
    where: { personId, type },
  });

  if (!hasAnyValue) {
    if (existing) await prisma.event.delete({ where: { id: existing.id } });
    return;
  }

  const place = await getOrCreatePlace(treeId, input, userId);

  const data = { date, placeId: place?.id ?? null };

  if (existing) {
    await prisma.event.update({ where: { id: existing.id }, data });
  } else {
    await prisma.event.create({
      data: {
        ...data,
        type,
        treeId,
        personId,
        createdById: userId,
      },
    });
  }
}

// Same shape as upsertEvent but scoped to a family (marriage / divorce).
export async function upsertFamilyEvent(
  familyId: string,
  treeId: string,
  userId: string,
  type: "MARRIAGE" | "DIVORCE",
  input: EventInput,
) {
  const date = parseDate(input.date);
  const placeName = input.placeName ?? input.placeText;
  const hasAnyValue = date !== null || placeName !== null;

  const existing = await prisma.event.findFirst({
    where: { familyId, type },
  });

  if (!hasAnyValue) {
    if (existing) await prisma.event.delete({ where: { id: existing.id } });
    return;
  }

  const place = await getOrCreatePlace(treeId, input, userId);

  const data = { date, placeId: place?.id ?? null };

  if (existing) {
    await prisma.event.update({ where: { id: existing.id }, data });
  } else {
    await prisma.event.create({
      data: {
        ...data,
        type,
        treeId,
        familyId,
        createdById: userId,
      },
    });
  }
}

export async function setParents(
  personId: string,
  treeId: string,
  parentAId: string | null,
  parentBId: string | null,
  userId: string,
) {
  // 1. Validate spouses exist and aren't the person themselves.
  for (const pid of [parentAId, parentBId]) {
    if (!pid) continue;
    if (pid === personId) {
      throw new Error("Une personne ne peut pas être son propre parent.");
    }
    const exists = await prisma.person.findFirst({
      where: { id: pid, treeId },
    });
    if (!exists) {
      throw new Error("Parent introuvable dans cet arbre.");
    }
  }

  // 2. Find current family-of-birth (if any) with sibling info.
  const currentFC = await prisma.familyChild.findFirst({
    where: { childId: personId },
    include: { family: { include: { children: { select: { id: true } } } } },
  });

  // 3. Clearing both parents → detach and clean up.
  if (!parentAId && !parentBId) {
    if (currentFC) {
      await detachChildLink(currentFC);
    }
    return;
  }

  // 4. Look for an existing family whose spouses match the requested pair,
  //    in either order. Crucial for sibling auto-detection: if both kids
  //    independently get the same parents set, they should end up in the
  //    same Family rather than getting two siblings-less copies.
  const matchingFamily = await prisma.family.findFirst({
    where: {
      treeId,
      OR: [
        { spouseAId: parentAId, spouseBId: parentBId },
        { spouseAId: parentBId, spouseBId: parentAId },
      ],
    },
  });

  if (matchingFamily) {
    if (currentFC?.familyId === matchingFamily.id) {
      return; // already in the right family
    }
    if (currentFC) {
      await detachChildLink(currentFC);
    }
    await prisma.familyChild.create({
      data: { familyId: matchingFamily.id, childId: personId },
    });
    return;
  }

  // 5. No matching family. Can we repurpose the current one?
  //    Only if it has just this person as a child (no siblings rely on it).
  if (currentFC) {
    const siblingCount = currentFC.family.children.length - 1;
    if (siblingCount === 0) {
      await prisma.family.update({
        where: { id: currentFC.familyId },
        data: { spouseAId: parentAId, spouseBId: parentBId },
      });
      return;
    }
    // Siblings are attached — leave their family alone, detach this person.
    await prisma.familyChild.delete({ where: { id: currentFC.id } });
  }

  // 6. Create a brand-new family with the requested spouses.
  const newFamily = await prisma.family.create({
    data: {
      treeId,
      spouseAId: parentAId,
      spouseBId: parentBId,
      createdById: userId,
    },
  });
  await prisma.familyChild.create({
    data: { familyId: newFamily.id, childId: personId },
  });
}

// Detach a FamilyChild link, and if the family is left with no spouses
// and no other children, delete the family row too so it doesn't litter.
async function detachChildLink(fc: {
  id: string;
  familyId: string;
  family: { spouseAId: string | null; spouseBId: string | null; children: { id: string }[] };
}) {
  await prisma.familyChild.delete({ where: { id: fc.id } });
  const remainingChildren = fc.family.children.length - 1;
  if (
    !fc.family.spouseAId &&
    !fc.family.spouseBId &&
    remainingChildren === 0
  ) {
    await prisma.family.delete({ where: { id: fc.familyId } });
  }
}

/**
 * Attaches a list of existing persons as children of `personId`. Best-effort
 * with three branches per child:
 *  - child already lists `personId` as a parent → no-op
 *  - child has a family-of-birth with one open spouse slot → fill it with personId
 *  - child has no family-of-birth → link them to a single shared "P + ø"
 *    family created for this call, so all newly-attached childless kids
 *    become siblings via that family
 * Children whose family-of-birth already has both parents are silently
 * skipped to avoid clobbering existing data; the user can rearrange them
 * by editing the child's parents.
 */
export async function attachExistingChildren(
  personId: string,
  childIds: string[],
  treeId: string,
  userId: string,
) {
  if (childIds.length === 0) return;
  const unique = [...new Set(childIds)].filter((id) => id && id !== personId);
  let sharedFamilyId: string | null = null;

  for (const childId of unique) {
    const child = await prisma.person.findFirst({
      where: { id: childId, treeId },
    });
    if (!child) continue;

    const childFC = await prisma.familyChild.findFirst({
      where: { childId },
      include: { family: true },
    });

    if (childFC) {
      const f = childFC.family;
      if (f.spouseAId === personId || f.spouseBId === personId) {
        continue; // already parented by this person
      }
      if (!f.spouseAId) {
        await prisma.family.update({
          where: { id: f.id },
          data: { spouseAId: personId },
        });
      } else if (!f.spouseBId) {
        await prisma.family.update({
          where: { id: f.id },
          data: { spouseBId: personId },
        });
      }
      // else both slots taken → skip
      continue;
    }

    // No family-of-birth → link to a shared single-parent family for this batch.
    if (!sharedFamilyId) {
      const f = await prisma.family.create({
        data: { treeId, spouseAId: personId, createdById: userId },
      });
      sharedFamilyId = f.id;
    }
    await prisma.familyChild.create({
      data: { familyId: sharedFamilyId, childId },
    });
  }
}

export async function linkAsSibling(
  newPersonId: string,
  existingSiblingId: string,
  treeId: string,
  userId: string,
) {
  const existingFC = await prisma.familyChild.findFirst({
    where: { childId: existingSiblingId },
  });
  if (existingFC) {
    await prisma.familyChild.create({
      data: { familyId: existingFC.familyId, childId: newPersonId },
    });
    return;
  }
  // Sibling had no family-of-birth — create one and link both.
  const family = await prisma.family.create({
    data: { treeId, createdById: userId },
  });
  await prisma.familyChild.createMany({
    data: [
      { familyId: family.id, childId: existingSiblingId },
      { familyId: family.id, childId: newPersonId },
    ],
  });
}
