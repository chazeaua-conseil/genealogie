"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireFamilyForCurrentUser,
  requirePersonForCurrentUser,
} from "@/lib/access";
import {
  EMPTY_EVENT_INPUT,
  EventInputSchema,
  upsertFamilyEvent,
} from "../../_lib/form";

const FamilyTypeSchema = z
  .enum(["MARRIAGE", "UNION", "RELIGIOUS", "OTHER"])
  .default("MARRIAGE");

const UnionInputSchema = z.object({
  partnerId: z
    .string()
    .trim()
    .min(1, "Le partenaire est obligatoire.")
    .max(40),
  type: FamilyTypeSchema,
  isDivorced: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v === "on"),
  marriage: EventInputSchema,
  divorce: EventInputSchema,
});

function readUnion(formData: FormData) {
  const readEventBlock = (prefix: "marriage" | "divorce") => ({
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

  return UnionInputSchema.parse({
    partnerId: formData.get("partnerId") ?? "",
    type: formData.get("type") ?? "MARRIAGE",
    isDivorced: formData.get("isDivorced"),
    marriage: readEventBlock("marriage"),
    divorce: readEventBlock("divorce"),
  });
}

export async function createUnion(personId: string, formData: FormData) {
  const { person, userId } = await requirePersonForCurrentUser(personId);
  const data = readUnion(formData);

  if (data.partnerId === person.id) {
    throw new Error("Une personne ne peut pas être en couple avec elle-même.");
  }
  const partner = await prisma.person.findFirst({
    where: { id: data.partnerId, treeId: person.treeId },
  });
  if (!partner) {
    throw new Error("Partenaire introuvable dans cet arbre.");
  }

  // Look for an existing family that already binds these two spouses; reuse
  // it if found (e.g. if it was created earlier as the parents of a child).
  let family = await prisma.family.findFirst({
    where: {
      treeId: person.treeId,
      OR: [
        { spouseAId: person.id, spouseBId: partner.id },
        { spouseAId: partner.id, spouseBId: person.id },
      ],
    },
  });

  if (family) {
    family = await prisma.family.update({
      where: { id: family.id },
      data: { type: data.type },
    });
  } else {
    family = await prisma.family.create({
      data: {
        treeId: person.treeId,
        type: data.type,
        spouseAId: person.id,
        spouseBId: partner.id,
        createdById: userId,
      },
    });
  }

  await upsertFamilyEvent(
    family.id,
    family.treeId,
    userId,
    "MARRIAGE",
    data.marriage,
  );

  await upsertFamilyEvent(
    family.id,
    family.treeId,
    userId,
    "DIVORCE",
    data.isDivorced ? data.divorce : EMPTY_EVENT_INPUT,
  );

  revalidatePath(`/persons/${person.id}/edit`);
  revalidatePath(`/persons/${partner.id}/edit`);
  redirect(`/persons/${person.id}/edit`);
}

export async function updateUnion(
  personId: string,
  familyId: string,
  formData: FormData,
) {
  const { person, userId } = await requirePersonForCurrentUser(personId);
  const { family } = await requireFamilyForCurrentUser(familyId, person.id);

  const data = readUnion(formData);

  if (data.partnerId === person.id) {
    throw new Error("Une personne ne peut pas être en couple avec elle-même.");
  }
  const partner = await prisma.person.findFirst({
    where: { id: data.partnerId, treeId: person.treeId },
  });
  if (!partner) {
    throw new Error("Partenaire introuvable dans cet arbre.");
  }

  // Keep `person` in their original slot (A or B) and put the (possibly new)
  // partner in the other slot. Avoids needlessly reshuffling the schema.
  const personSlot = family.spouseAId === person.id ? "A" : "B";
  const nextSpouseAId = personSlot === "A" ? person.id : partner.id;
  const nextSpouseBId = personSlot === "A" ? partner.id : person.id;

  await prisma.family.update({
    where: { id: family.id },
    data: {
      type: data.type,
      spouseAId: nextSpouseAId,
      spouseBId: nextSpouseBId,
    },
  });

  await upsertFamilyEvent(
    family.id,
    family.treeId,
    userId,
    "MARRIAGE",
    data.marriage,
  );

  await upsertFamilyEvent(
    family.id,
    family.treeId,
    userId,
    "DIVORCE",
    data.isDivorced ? data.divorce : EMPTY_EVENT_INPUT,
  );

  revalidatePath(`/persons/${person.id}/edit`);
  revalidatePath(`/persons/${partner.id}/edit`);
  redirect(`/persons/${person.id}/edit`);
}

export async function deleteUnion(personId: string, familyId: string) {
  const { person } = await requirePersonForCurrentUser(personId);
  const { family } = await requireFamilyForCurrentUser(familyId, person.id);

  // If the family also has children, keep it but null out the spouses + drop
  // its events. Otherwise delete the family outright.
  const childCount = await prisma.familyChild.count({
    where: { familyId: family.id },
  });

  await prisma.event.deleteMany({
    where: { familyId: family.id, type: { in: ["MARRIAGE", "DIVORCE"] } },
  });

  if (childCount === 0) {
    await prisma.family.delete({ where: { id: family.id } });
  } else {
    // Keep the family for the children but disconnect the spouses to make
    // it clear the union itself is gone.
    await prisma.family.update({
      where: { id: family.id },
      data: { spouseAId: null, spouseBId: null },
    });
  }

  revalidatePath(`/persons/${person.id}/edit`);
  redirect(`/persons/${person.id}/edit`);
}
