import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { inviteMember } from "./actions";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { RevokeInvitationButton } from "./RevokeInvitationButton";

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source
    .replace(/[._-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

const roleConfig: Record<
  "OWNER" | "EDITOR" | "VIEWER",
  { label: string; className: string }
> = {
  OWNER: {
    label: "Propriétaire",
    className:
      "bg-amber-50 text-amber-700 ring-amber-700/15 dark:bg-amber-950/40 dark:text-amber-300",
  },
  EDITOR: {
    label: "Éditeur",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-700/15 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  VIEWER: {
    label: "Lecteur",
    className: "bg-muted text-muted-foreground ring-foreground/10",
  },
};

function RoleBadge({ role }: { role: "OWNER" | "EDITOR" | "VIEWER" }) {
  const c = roleConfig[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const tree = await getOrCreateDefaultTree(session.user.id);

  const members = await prisma.treeMember.findMany({
    where: { treeId: tree.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const invitations = await prisma.treeInvitation.findMany({
    where: { treeId: tree.id, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <Link
          href="/persons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour à l&apos;arbre
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">
          Membres de {tree.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Les membres ont accès aux mêmes personnes et peuvent les éditer.
          Invite quelqu&apos;un par email — il rejoindra l&apos;arbre dès sa
          prochaine connexion Google.
        </p>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-4">
          Membres ({members.length})
        </h2>
        <ul className="divide-y">
          {members.map((m) => {
            const isSelf = m.userId === session.user!.id;
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {initials(m.user.name, m.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {m.user.name ?? m.user.email}
                    {isSelf && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (toi)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.user.email}
                  </div>
                </div>
                <RoleBadge role={m.role} />
                <RemoveMemberButton
                  memberId={m.id}
                  label={m.user.name ?? m.user.email ?? "membre"}
                  isSelf={isSelf}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-4">
          Invitations en attente ({invitations.length})
        </h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune invitation en attente.
          </p>
        ) : (
          <ul className="divide-y">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 py-3 text-sm"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Invitée le{" "}
                    {new Intl.DateTimeFormat("fr-FR").format(inv.createdAt)}
                  </div>
                </div>
                <RoleBadge role={inv.role} />
                <RevokeInvitationButton
                  invitationId={inv.id}
                  email={inv.email}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-4">
          Inviter un membre
        </h2>
        <form action={inviteMember} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Adresse email Google</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="prenom.nom@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Rôle</Label>
              <select
                id="invite-role"
                name="role"
                defaultValue="EDITOR"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="EDITOR">Éditeur (lecture + édition)</option>
                <option value="OWNER">Propriétaire (gère les membres)</option>
                <option value="VIEWER">Lecteur (lecture seule)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ L&apos;email doit aussi être ajouté comme &laquo; Test user
            &raquo; dans Google Cloud Console &gt; OAuth consent screen, et
            figurer dans <code>ALLOWED_EMAILS</code> côté serveur pour pouvoir
            se connecter.
          </p>
          <Button type="submit">
            <Plus className="h-4 w-4 mr-1.5" />
            Envoyer l&apos;invitation
          </Button>
        </form>
      </section>
    </main>
  );
}
