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

const DateQualifierSchema = z.enum([
  "EXACT",
  "ABOUT",
  "BEFORE",
  "AFTER",
  "BETWEEN",
  "ESTIMATED",
]);

const EventInputSchema = z.object({
  date: trimmedOptional(20), // ISO yyyy-mm-dd from <input type="date">
  dateEnd: trimmedOptional(20),
  dateQualifier: DateQualifierSchema.default("EXACT"),
  dateText: trimmedOptional(80),
  placeText: trimmedOptional(160),
});

const UpdatePersonSchema = z.object({
  prefix: trimmedOptional(40),
  givenName: trimmedOptional(120),
  surname: trimmedOptional(120),
  marriedName: trimmedOptional(120),
  nickname: trimmedOptional(120),
  suffix: trimmedOptional(20),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  isLiving: z.string().nullable().optional().transform((v) => v === "on"),
  privacy: z.string().nullable().optional().transform((v) => v === "on"),
  notes: trimmedOptional(5000),
  birth: EventInputSchema,
  death: EventInputSchema,
});

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function getOrCreatePlace(
  treeId: string,
  name: string | null,
  userId: string,
) {
  if (!name) return null;
  const existing = await prisma.place.findFirst({
    where: { treeId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  return prisma.place.create({
    data: { treeId, name, createdById: userId },
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
  const hasAnyValue =
    date !== null ||
    dateEnd !== null ||
    input.dateText !== null ||
    input.placeText !== null;

  const existing = await prisma.event.findFirst({
    where: { personId, type },
  });

  if (!hasAnyValue) {
    if (existing) await prisma.event.delete({ where: { id: existing.id } });
    return;
  }

  const place = await getOrCreatePlace(treeId, input.placeText, userId);

  const data = {
    date,
    dateEnd: input.dateQualifier === "BETWEEN" ? dateEnd : null,
    dateQualifier: input.dateQualifier,
    dateText: input.dateText,
    placeId: place?.id ?? null,
  };

  if (existing) {
    await prisma.event.update({
      where: { id: existing.id },
      data,
    });
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

function readEvent(prefix: "birth" | "death", formData: FormData) {
  return {
    date: formData.get(`${prefix}.date`) ?? "",
    dateEnd: formData.get(`${prefix}.dateEnd`) ?? "",
    dateQualifier: formData.get(`${prefix}.dateQualifier`) ?? "EXACT",
    dateText: formData.get(`${prefix}.dateText`) ?? "",
    placeText: formData.get(`${prefix}.placeText`) ?? "",
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
