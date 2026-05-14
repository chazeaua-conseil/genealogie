"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import {
  EMPTY_EVENT_INPUT,
  readEvent,
  readParents,
  readPersonCore,
  setParents,
  upsertEvent,
} from "../_lib/form";

export async function updatePerson(id: string, formData: FormData) {
  const { person, userId } = await requirePersonForCurrentUser(id);

  const core = readPersonCore(formData);
  if (core.givenName === null && core.surname === null) {
    throw new Error("Au moins le prénom ou le nom est requis.");
  }

  const birth = readEvent("birth", formData);
  // A living person cannot have a death event — wipe it regardless of the
  // (visually hidden) death.* form fields.
  const death = core.isLiving
    ? EMPTY_EVENT_INPUT
    : readEvent("death", formData);
  const parents = readParents(formData);

  await prisma.person.update({
    where: { id: person.id },
    data: {
      givenName: core.givenName,
      surname: core.surname,
      marriedName: core.marriedName,
      nickname: core.nickname,
      sex: core.sex,
      isLiving: core.isLiving,
      notes: core.notes,
      updatedById: userId,
    },
  });

  await upsertEvent(person.id, person.treeId, userId, "BIRTH", birth);
  await upsertEvent(person.id, person.treeId, userId, "DEATH", death);
  await setParents(person.id, person.treeId, parents.A, parents.B, userId);

  revalidatePath("/persons");
  revalidatePath(`/persons/${person.id}/edit`);
  redirect("/persons");
}

export async function deletePerson(id: string) {
  const { person } = await requirePersonForCurrentUser(id);

  // Detach the person from any Family they belong to as a spouse so the
  // foreign key doesn't block the delete. Family records and shared children
  // are preserved; the surviving spouse / children just lose the reference.
  await prisma.family.updateMany({
    where: { spouseAId: person.id },
    data: { spouseAId: null },
  });
  await prisma.family.updateMany({
    where: { spouseBId: person.id },
    data: { spouseBId: null },
  });

  await prisma.person.delete({ where: { id: person.id } });
  revalidatePath("/persons");
  redirect("/persons");
}
