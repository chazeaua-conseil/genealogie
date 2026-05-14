import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Asserts that the current session can edit the given person. Returns the
 * person with its tree id; redirects to /persons (or /) on failure so it can
 * be called directly from server components and Server Actions.
 */
export async function requirePersonForCurrentUser(personId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const person = await prisma.person.findFirst({
    where: {
      id: personId,
      tree: { members: { some: { userId: session.user.id } } },
    },
  });
  if (!person) redirect("/persons");

  return { person, userId: session.user.id };
}

/**
 * Asserts that the current session can edit the given family record.
 * Optionally enforces that `expectedSpouseId` is one of the family's spouses
 * (so a user can't pass an unrelated familyId to an action scoped under a
 * person's URL).
 */
export async function requireFamilyForCurrentUser(
  familyId: string,
  expectedSpouseId?: string,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const family = await prisma.family.findFirst({
    where: {
      id: familyId,
      tree: { members: { some: { userId: session.user.id } } },
    },
  });
  if (!family) redirect("/persons");

  if (
    expectedSpouseId &&
    family.spouseAId !== expectedSpouseId &&
    family.spouseBId !== expectedSpouseId
  ) {
    redirect(`/persons/${expectedSpouseId}/edit`);
  }

  return { family, userId: session.user.id };
}
