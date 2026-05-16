"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EMPTY_EVENT_INPUT,
  attachExistingChildren,
  linkAsSibling,
  readEvent,
  readParents,
  readPersonCore,
  setParents,
  upsertEvent,
} from "./_lib/form";

function readChildIds(formData: FormData): string[] {
  return formData
    .getAll("childIds")
    .map((v) => v.toString().trim())
    .filter(Boolean);
}

export async function createPerson(formData: FormData) {
  try {
    return await _createPerson(formData);
  } catch (err) {
    // Re-throw Next.js redirect/notFound signals — they're not real errors.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      ((err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
        (err as { digest: string }).digest === "NEXT_NOT_FOUND")
    ) {
      throw err;
    }
    console.error("[createPerson] failed:", err);
    throw err;
  }
}

async function _createPerson(formData: FormData) {
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

  // Optional: create as a child of an existing union (Family). The parents
  // come from that family and the form's Parents step is hidden on the page.
  const childOfFamilyRaw = (formData.get("childOfFamily") ?? "").toString().trim();
  const childOfFamily = childOfFamilyRaw
    ? await prisma.family.findFirst({
        where: { id: childOfFamilyRaw, treeId: tree.id },
        select: { id: true, spouseAId: true, spouseBId: true },
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

  // Parent linking: 3 mutually exclusive paths.
  // 1. childOfFamily: hook into an existing union (Family), inheriting its
  //    spouses as parents. The Parents step is hidden in the form.
  // 2. siblingOf: hook into the existing family-of-birth of an existing
  //    sibling. The Parents step is hidden.
  // 3. Default: read the Parents step from the form.
  let redirectAfter = "/persons";
  if (childOfFamily) {
    await prisma.familyChild.create({
      data: { familyId: childOfFamily.id, childId: newPerson.id },
    });
    // Redirect back to whichever parent fronted the user; default to spouseA.
    const focusParentId = childOfFamily.spouseAId ?? childOfFamily.spouseBId;
    if (focusParentId) {
      revalidatePath(`/persons/${focusParentId}/edit`);
      redirectAfter = `/persons/${focusParentId}/edit`;
    }
  } else if (siblingRef) {
    await linkAsSibling(newPerson.id, siblingRef.id, tree.id, userId);
    revalidatePath(`/persons/${siblingRef.id}/edit`);
    redirectAfter = `/persons/${siblingRef.id}/edit`;
  } else {
    const parents = readParents(formData);
    await setParents(newPerson.id, tree.id, parents.A, parents.B, userId);
  }

  // Optional: link existing persons as children of the new person.
  const childIds = readChildIds(formData);
  if (childIds.length > 0) {
    await attachExistingChildren(newPerson.id, childIds, tree.id, userId);
  }

  revalidatePath("/persons");
  redirect(redirectAfter);
}
