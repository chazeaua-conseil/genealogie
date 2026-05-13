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
  });

  const tree = await getOrCreateDefaultTree(session.user.id);

  await prisma.person.create({
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

  revalidatePath("/persons");
  redirect("/persons");
}
