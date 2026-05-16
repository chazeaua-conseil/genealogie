import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { buttonVariants } from "@/components/ui/button";
import { PersonsTable, type PersonRow } from "./_components/PersonsTable";

export default async function PersonsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const tree = await getOrCreateDefaultTree(session.user.id);
  const persons = await prisma.person.findMany({
    where: { treeId: tree.id },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    include: {
      events: {
        where: { type: { in: ["BIRTH", "DEATH"] } },
        include: { place: { select: { name: true } } },
      },
    },
  });

  const rows: PersonRow[] = persons.map((p) => {
    const birth = p.events.find((e) => e.type === "BIRTH");
    const death = p.events.find((e) => e.type === "DEATH");
    return {
      id: p.id,
      givenName: p.givenName,
      surname: p.surname,
      marriedName: p.marriedName,
      nickname: p.nickname,
      sex: p.sex,
      isLiving: p.isLiving,
      birth: birth
        ? {
            date: birth.date,
            place: birth.place ? { name: birth.place.name } : null,
          }
        : null,
      death: death
        ? {
            date: death.date,
            place: death.place ? { name: death.place.name } : null,
          }
        : null,
    };
  });

  return (
    <main className="container mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{tree.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {persons.length} personne{persons.length > 1 ? "s" : ""}{" "}
            enregistrée{persons.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/persons/import"
            className={buttonVariants({ variant: "outline", size: "default" })}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Importer un CSV
          </Link>
          <Link
            href="/persons/new"
            className={buttonVariants({ size: "default" })}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle personne
          </Link>
        </div>
      </header>

      {persons.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-16 text-center">
          <p className="text-muted-foreground mb-4">
            Aucune personne dans cet arbre pour le moment.
          </p>
          <Link
            href="/persons/new"
            className={buttonVariants({ variant: "outline" })}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter la première
          </Link>
        </div>
      ) : (
        <PersonsTable persons={rows} />
      )}
    </main>
  );
}
