import { prisma } from "@/lib/prisma";

/**
 * Returns the user's default working tree, creating one if needed.
 * For the MVP each user gets a single tree, auto-created on first visit.
 * A multi-tree UI will follow when multiple arbres are actually used.
 */
export async function getOrCreateDefaultTree(userId: string) {
  const existing = await prisma.treeMember.findFirst({
    where: { userId },
    include: { tree: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.tree;

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
