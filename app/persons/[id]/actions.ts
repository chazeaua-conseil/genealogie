"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s.length === 0 ? null : s))
    .nullable();

const optionalFloat = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? null : Number.parseFloat(s)))
  .nullable()
  .refine((n) => n === null || !Number.isNaN(n), { message: "invalid number" });

const DateQualifierSchema = z.enum([
  "EXACT",
  "ABOUT",
  "BEFORE",
  "AFTER",
  "BETWEEN",
  "ESTIMATED",
]);

const PlaceInputSchema = z.object({
  placeText: trimmedOptional(160),
  placeName: trimmedOptional(160),
  placeDepartment: trimmedOptional(100),
  placeRegion: trimmedOptional(100),
  placeCountry: trimmedOptional(100),
  placeLatitude: optionalFloat,
  placeLongitude: optionalFloat,
});

const EventInputSchema = z
  .object({
    date: trimmedOptional(20),
    dateEnd: trimmedOptional(20),
    dateQualifier: DateQualifierSchema.default("EXACT"),
    dateText: trimmedOptional(80),
  })
  .merge(PlaceInputSchema);

const UpdatePersonSchema = z.object({
  prefix: trimmedOptional(40),
  givenName: trimmedOptional(120),
  surname: trimmedOptional(120),
  marriedName: trimmedOptional(120),
  nickname: trimmedOptional(120),
  suffix: trimmedOptional(20),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  isLiving: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v === "on"),
  privacy: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v === "on"),
  notes: trimmedOptional(5000),
  birth: EventInputSchema,
  death: EventInputSchema,
  parentAId: trimmedOptional(40),
  parentBId: trimmedOptional(40),
});

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function getOrCreatePlace(
  treeId: string,
  input: z.infer<typeof PlaceInputSchema>,
  userId: string,
) {
  const name = input.placeName ?? input.placeText;
  if (!name) return null;

  const existing = await prisma.place.findFirst({
    where: { treeId, name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    // Enrich with structured data if the user picked a Nominatim suggestion
    // and the existing record was created previously from plain text.
    const enrichments: Record<string, string | number> = {};
    if (input.placeDepartment && !existing.department)
      enrichments.department = input.placeDepartment;
    if (input.placeRegion && !existing.region)
      enrichments.region = input.placeRegion;
    if (input.placeCountry && existing.country === null)
      enrichments.country = input.placeCountry;
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
      country: input.placeCountry ?? "France",
      latitude: input.placeLatitude,
      longitude: input.placeLongitude,
      createdById: userId,
    },
  });
}

async function upsertEvent(
  personId: string,
  treeId: string,
  userId: string,
  type: "BIRTH" | "DEATH",
  input: z.infer<typeof EventInputSchema>,
) {
  const date = parseDate(input.date);
  const dateEnd = parseDate(input.dateEnd);
  const placeName = input.placeName ?? input.placeText;
  const hasAnyValue =
    date !== null ||
    dateEnd !== null ||
    input.dateText !== null ||
    placeName !== null;

  const existing = await prisma.event.findFirst({
    where: { personId, type },
  });

  if (!hasAnyValue) {
    if (existing) await prisma.event.delete({ where: { id: existing.id } });
    return;
  }

  const place = await getOrCreatePlace(treeId, input, userId);

  const data = {
    date,
    dateEnd: input.dateQualifier === "BETWEEN" ? dateEnd : null,
    dateQualifier: input.dateQualifier,
    dateText: input.dateText,
    placeId: place?.id ?? null,
  };

  if (existing) {
    await prisma.event.update({ where: { id: existing.id }, data });
  } else {
    await prisma.event.create({
      data: { ...data, type, treeId, personId, createdById: userId },
    });
  }
}

async function setParents(
  personId: string,
  treeId: string,
  parentAId: string | null,
  parentBId: string | null,
  userId: string,
) {
  // Validation: parents must belong to the same tree and not be the person itself.
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

  let familyChild = await prisma.familyChild.findFirst({
    where: { childId: personId },
  });

  // Both parents cleared
  if (!parentAId && !parentBId) {
    if (familyChild) {
      const family = await prisma.family.findUnique({
        where: { id: familyChild.familyId },
        include: { children: true },
      });
      await prisma.familyChild.delete({ where: { id: familyChild.id } });
      // Clean up an orphan family (no spouses, no remaining children)
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

  // We need a family record for this person.
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

function readEvent(prefix: "birth" | "death", formData: FormData) {
  return {
    date: formData.get(`${prefix}.date`) ?? "",
    dateEnd: formData.get(`${prefix}.dateEnd`) ?? "",
    dateQualifier: formData.get(`${prefix}.dateQualifier`) ?? "EXACT",
    dateText: formData.get(`${prefix}.dateText`) ?? "",
    placeText: formData.get(`${prefix}.placeText`) ?? "",
    placeName: formData.get(`${prefix}.placeName`) ?? "",
    placeDepartment: formData.get(`${prefix}.placeDepartment`) ?? "",
    placeRegion: formData.get(`${prefix}.placeRegion`) ?? "",
    placeCountry: formData.get(`${prefix}.placeCountry`) ?? "",
    placeLatitude: formData.get(`${prefix}.placeLatitude`) ?? "",
    placeLongitude: formData.get(`${prefix}.placeLongitude`) ?? "",
  };
}

export async function updatePerson(id: string, formData: FormData) {
  const { person, userId } = await requirePersonForCurrentUser(id);

  const data = UpdatePersonSchema.parse({
    prefix: formData.get("prefix") ?? "",
    givenName: formData.get("givenName") ?? "",
    surname: formData.get("surname") ?? "",
    marriedName: formData.get("marriedName") ?? "",
    nickname: formData.get("nickname") ?? "",
    suffix: formData.get("suffix") ?? "",
    sex: formData.get("sex") ?? "UNKNOWN",
    isLiving: formData.get("isLiving"),
    privacy: formData.get("privacy"),
    notes: formData.get("notes") ?? "",
    birth: readEvent("birth", formData),
    death: readEvent("death", formData),
    parentAId: formData.get("parentAId") ?? "",
    parentBId: formData.get("parentBId") ?? "",
  });

  if (data.givenName === null && data.surname === null) {
    throw new Error("Au moins le prénom ou le nom est requis.");
  }

  await prisma.person.update({
    where: { id: person.id },
    data: {
      prefix: data.prefix,
      givenName: data.givenName,
      surname: data.surname,
      marriedName: data.marriedName,
      nickname: data.nickname,
      suffix: data.suffix,
      sex: data.sex,
      isLiving: data.isLiving,
      privacy: data.privacy,
      notes: data.notes,
      updatedById: userId,
    },
  });

  await upsertEvent(person.id, person.treeId, userId, "BIRTH", data.birth);
  await upsertEvent(person.id, person.treeId, userId, "DEATH", data.death);
  await setParents(
    person.id,
    person.treeId,
    data.parentAId,
    data.parentBId,
    userId,
  );

  revalidatePath("/persons");
  revalidatePath(`/persons/${person.id}/edit`);
  redirect("/persons");
}

export async function deletePerson(id: string) {
  const { person } = await requirePersonForCurrentUser(id);
  await prisma.person.delete({ where: { id: person.id } });
  revalidatePath("/persons");
  redirect("/persons");
}
