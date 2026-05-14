"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import {
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
  const death = readEvent("death", formData);
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
  await prisma.person.delete({ where: { id: person.id } });
  revalidatePath("/persons");
  redirect("/persons");
}
