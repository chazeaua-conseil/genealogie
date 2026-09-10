import { prisma } from "@/lib/prisma";

/**
 * Returns the user's working tree, creating one if they belong to none.
 *
 * A user can end up with several memberships: an empty tree auto-created on
 * their first visit (before anyone invited them), plus the shared family tree
 * they were later invited to. Picking the oldest membership would strand them
 * on their empty tree forever, so rank the candidates instead:
 *   1. most persons recorded — the tree actually being worked on
 *   2. most members — a shared tree beats a solo leftover, even when empty
 *   3. oldest membership — stable tie-break
 *
 * A real multi-tree switcher will replace this when several trees are actually
 * in use.
 */
export async function getOrCreateDefaultTree(userId: string) {
  const memberships = await prisma.treeMember.findMany({
    where: { userId },
    select: {
      createdAt: true,
      tree: {
        select: {
          id: true,
          _count: { select: { persons: true, members: true } },
        },
      },
    },
  });

  if (memberships.length > 0) {
    const best = memberships.reduce((a, b) => (compare(b, a) > 0 ? b : a));
    return prisma.tree.findUniqueOrThrow({ where: { id: best.tree.id } });
  }

  return prisma.tree.create({
    data: {
      name: "Mon arbre",
      description: "Arbre créé automatiquement à la première connexion.",
      members: {
        create: { userId, role: "OWNER" },
      },
    },
  });
}

type Candidate = {
  createdAt: Date;
  tree: { _count: { persons: number; members: number } };
};

/** Positive when `a` is the better default tree. */
function compare(a: Candidate, b: Candidate) {
  return (
    a.tree._count.persons - b.tree._count.persons ||
    a.tree._count.members - b.tree._count.members ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}
