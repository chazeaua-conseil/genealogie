import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { Button, buttonVariants } from "@/components/ui/button";

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

const sexLabel: Record<"MALE" | "FEMALE" | "UNKNOWN", string> = {
  MALE: "♂",
  FEMALE: "♀",
  UNKNOWN: "·",
};

export default async function PersonsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const tree = await getOrCreateDefaultTree(session.user.id);
  const persons = await prisma.person.findMany({
    where: { treeId: tree.id },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
  });

  return (
    <main className="min-h-screen max-w-3xl mx-auto p-8">
      <header className="flex items-baseline justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tree.name}</h1>
          <p className="text-sm text-muted-foreground">
            {persons.length} personne{persons.length > 1 ? "s" : ""}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            {session.user.email} · Déconnexion
          </Button>
        </form>
      </header>

      <div className="flex justify-end mb-6">
        <Link href="/persons/new" className={buttonVariants()}>
          + Ajouter une personne
        </Link>
      </div>

      {persons.length === 0 ? (
        <div className="border border-dashed rounded-lg py-16 text-center text-muted-foreground">
          <p className="mb-4">Aucune personne pour le moment.</p>
          <Link
            href="/persons/new"
            className={buttonVariants({ variant: "outline" })}
          >
            Ajouter la première
          </Link>
        </div>
      ) : (
        <ul className="divide-y border rounded-lg">
          {persons.map((p) => (
            <li key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <Link
                href={`/persons/${p.id}/edit`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <span
                  className="text-muted-foreground w-6 text-center"
                  aria-label={p.sex}
                >
                  {sexLabel[p.sex]}
                </span>
                <span className="font-medium truncate">{displayName(p)}</span>
                {p.nickname && (
                  <span className="text-sm text-muted-foreground truncate">
                    « {p.nickname} »
                  </span>
                )}
              </Link>
              <Link
                href={`/persons/${p.id}/tree`}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0 ml-3"
                title="Voir l'arbre"
              >
                🌳
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
