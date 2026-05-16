"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";

const TreeRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]).default("EDITOR");

const InviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Adresse email invalide"),
  role: TreeRoleSchema,
});

async function requireTreeAndUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Non authentifié");
  }
  const tree = await getOrCreateDefaultTree(session.user.id);
  return { tree, userId: session.user.id, userEmail: session.user.email ?? null };
}

export async function inviteMember(formData: FormData) {
  const { tree, userId, userEmail } = await requireTreeAndUser();

  const { email, role } = InviteSchema.parse({
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "EDITOR",
  });

  if (userEmail && email === userEmail.toLowerCase()) {
    throw new Error("Tu es déjà membre de cet arbre.");
  }

  // If a User already exists with this email and is already a member, refuse.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const member = await prisma.treeMember.findUnique({
      where: { treeId_userId: { treeId: tree.id, userId: existingUser.id } },
    });
    if (member) {
      throw new Error("Cette personne est déjà membre de l'arbre.");
    }
  }

  // Upsert the pending invitation (refresh date + role if it already exists).
  await prisma.treeInvitation.upsert({
    where: { treeId_email: { treeId: tree.id, email } },
    update: { role, acceptedAt: null, invitedById: userId },
    create: { treeId: tree.id, email, role, invitedById: userId },
  });

  // If the invitee already has an account (signed in previously), turn the
  // invitation into a TreeMember immediately instead of waiting for them to
  // sign in again.
  if (existingUser) {
    await prisma.treeMember.create({
      data: { treeId: tree.id, userId: existingUser.id, role },
    });
    await prisma.treeInvitation.update({
      where: { treeId_email: { treeId: tree.id, email } },
      data: { acceptedAt: new Date() },
    });
  }

  revalidatePath("/tree/members");
}

export async function revokeInvitation(invitationId: string) {
  const { tree } = await requireTreeAndUser();

  await prisma.treeInvitation.deleteMany({
    where: { id: invitationId, treeId: tree.id },
  });

  revalidatePath("/tree/members");
}

export async function removeMember(memberId: string) {
  const { tree, userId } = await requireTreeAndUser();

  const member = await prisma.treeMember.findFirst({
    where: { id: memberId, treeId: tree.id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!member) return;

  // Don't allow removing the last OWNER (would orphan the tree).
  if (member.role === "OWNER") {
    const ownerCount = await prisma.treeMember.count({
      where: { treeId: tree.id, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      throw new Error(
        "Impossible de retirer le dernier propriétaire de l'arbre.",
      );
    }
  }

  // Allow self-removal only if there are at least two members left.
  if (member.user.id === userId) {
    const total = await prisma.treeMember.count({
      where: { treeId: tree.id },
    });
    if (total <= 1) {
      throw new Error(
        "Tu ne peux pas te retirer toi-même si tu es le seul membre.",
      );
    }
  }

  await prisma.treeMember.delete({ where: { id: member.id } });
  revalidatePath("/tree/members");
}
