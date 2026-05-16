import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  callbacks: {
    async signIn({ user }) {
      // Allowlist of authorized email addresses (comma-separated env var).
      // Empty allowlist = open in dev; production should always set this.
      const allowed = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length === 0) return true;
      return allowed.includes((user.email ?? "").toLowerCase());
    },
    async session({ session, user }) {
      // Surface the user id on the session for downstream use.
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // When a user signs in, consume any pending TreeInvitation matching
    // their email and turn them into TreeMember rows. This is how a parent
    // shares their tree with another family member — they invite by email,
    // and the invitee auto-joins on their first sign-in (or next one).
    async signIn({ user }) {
      if (!user.id || !user.email) return;
      const email = user.email.toLowerCase();
      const invitations = await prisma.treeInvitation.findMany({
        where: { email, acceptedAt: null },
      });
      for (const invite of invitations) {
        const existing = await prisma.treeMember.findUnique({
          where: { treeId_userId: { treeId: invite.treeId, userId: user.id } },
        });
        if (!existing) {
          await prisma.treeMember.create({
            data: {
              treeId: invite.treeId,
              userId: user.id,
              role: invite.role,
            },
          });
        }
        await prisma.treeInvitation.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });
      }
    },
  },
});
