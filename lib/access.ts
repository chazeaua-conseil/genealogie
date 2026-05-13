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
