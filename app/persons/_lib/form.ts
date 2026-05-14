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

export async function setParents(
  personId: string,
  treeId: string,
  parentAId: string | null,
  parentBId: string | null,
  userId: string,
) {
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

  const familyChild = await prisma.familyChild.findFirst({
    where: { childId: personId },
  });

  if (!parentAId && !parentBId) {
    if (familyChild) {
      const family = await prisma.family.findUnique({
        where: { id: familyChild.familyId },
        include: { children: true },
      });
      await prisma.familyChild.delete({ where: { id: familyChild.id } });
      if (
        family &&
        !family.spouseAId &&
        !family.spouseBId &&
        family.children.length <= 1
      ) {
        await prisma.family.delete({ where: { id: family.id } });
      }
    }
    return;
  }

  let familyId: string;
  if (familyChild) {
    familyId = familyChild.familyId;
  } else {
    const newFamily = await prisma.family.create({
      data: { treeId, createdById: userId },
    });
    familyId = newFamily.id;
    await prisma.familyChild.create({
      data: { familyId, childId: personId },
    });
  }

  await prisma.family.update({
    where: { id: familyId },
    data: { spouseAId: parentAId, spouseBId: parentBId },
  });
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
