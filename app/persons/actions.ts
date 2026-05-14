"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EMPTY_EVENT_INPUT,
  linkAsSibling,
  readEvent,
  readParents,
  readPersonCore,
  setParents,
  upsertEvent,
} from "./_lib/form";

export async function createPerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  const userId = session.user.id;

  const core = readPersonCore(formData);
  if (core.givenName === null && core.surname === null) {
    throw new Error("Au moins le prénom ou le nom est requis.");
  }

  const tree = await getOrCreateDefaultTree(userId);

  const siblingOfRaw = (formData.get("siblingOf") ?? "").toString().trim();
  const siblingRef = siblingOfRaw
    ? await prisma.person.findFirst({
        where: { id: siblingOfRaw, treeId: tree.id },
      })
    : null;

  // Create the person first so subsequent helpers can reference it.
  const newPerson = await prisma.person.create({
    data: {
      treeId: tree.id,
      givenName: core.givenName,
      surname: core.surname,
      marriedName: core.marriedName,
      nickname: core.nickname,
      sex: core.sex,
      isLiving: core.isLiving,
      notes: core.notes,
      createdById: userId,
      updatedById: userId,
    },
  });

  // Apply optional events and parents, exactly like updatePerson.
  const birth = readEvent("birth", formData);
  // Skip the death event entirely if the person is marked as living.
  const death = core.isLiving
    ? EMPTY_EVENT_INPUT
    : readEvent("death", formData);
  await upsertEvent(newPerson.id, tree.id, userId, "BIRTH", birth);
  await upsertEvent(newPerson.id, tree.id, userId, "DEATH", death);

  // If creating as a sibling, hook into the existing family-of-birth.
  // The form does not surface parent dropdowns in that case (parents are
  // inherited), so we skip setParents.
  if (siblingRef) {
    await linkAsSibling(newPerson.id, siblingRef.id, tree.id, userId);
  } else {
    const parents = readParents(formData);
    await setParents(newPerson.id, tree.id, parents.A, parents.B, userId);
  }

  revalidatePath("/persons");
  if (siblingRef) {
    revalidatePath(`/persons/${siblingRef.id}/edit`);
    redirect(`/persons/${siblingRef.id}/edit`);
  }
  redirect("/persons");
}
