"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .max(120)
  .transform((s) => (s.length === 0 ? null : s))
  .nullable();

const CreatePersonSchema = z
  .object({
    givenName: trimmedOptional,
    surname: trimmedOptional,
    sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
    notes: z
      .string()
      .trim()
      .max(5000)
      .transform((s) => (s.length === 0 ? null : s))
      .nullable()
      .optional(),
    siblingOf: z
      .string()
      .trim()
      .max(40)
      .transform((s) => (s.length === 0 ? null : s))
      .nullable()
      .optional(),
  })
  .refine((data) => data.givenName !== null || data.surname !== null, {
    message: "Renseigne au moins le prénom ou le nom",
    path: ["givenName"],
  });

export async function createPerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const data = CreatePersonSchema.parse({
    givenName: formData.get("givenName") ?? "",
    surname: formData.get("surname") ?? "",
    sex: formData.get("sex") ?? "UNKNOWN",
    notes: formData.get("notes") ?? "",
    siblingOf: formData.get("siblingOf") ?? "",
  });

  const tree = await getOrCreateDefaultTree(session.user.id);

  // Validate siblingOf belongs to the same tree (if provided)
  const siblingRef = data.siblingOf
    ? await prisma.person.findFirst({
        where: { id: data.siblingOf, treeId: tree.id },
      })
    : null;

  const newPerson = await prisma.person.create({
    data: {
      treeId: tree.id,
      givenName: data.givenName,
      surname: data.surname,
      sex: data.sex,
      notes: data.notes ?? null,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  // If created as a sibling, hook into the existing family-of-birth.
  if (siblingRef) {
    const existingFC = await prisma.familyChild.findFirst({
      where: { childId: siblingRef.id },
    });
    if (existingFC) {
      await prisma.familyChild.create({
        data: { familyId: existingFC.familyId, childId: newPerson.id },
      });
    } else {
      // Sibling had no family-of-birth — create one and link both.
      const family = await prisma.family.create({
        data: { treeId: tree.id, createdById: session.user.id },
      });
      await prisma.familyChild.createMany({
        data: [
          { familyId: family.id, childId: siblingRef.id },
          { familyId: family.id, childId: newPerson.id },
        ],
      });
    }
  }

  revalidatePath("/persons");
  if (siblingRef) {
    revalidatePath(`/persons/${siblingRef.id}/edit`);
    redirect(`/persons/${siblingRef.id}/edit`);
  }
  redirect("/persons");
}
