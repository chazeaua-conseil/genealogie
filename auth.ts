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
});
