import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, LayoutGrid, Plus, Upload } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PersonsTable, type PersonRow } from "./_components/PersonsTable";

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { created } = await searchParams;
  const createdCount = Number(created);

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
    <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <PageHeader
        eyebrow={tree.name}
        title="Toutes les personnes"
        description={`${persons.length} personne${persons.length > 1 ? "s" : ""} enregistrée${persons.length > 1 ? "s" : ""} dans l'arbre.`}
        actions={
          <>
            <Link
              href="/persons/import"
              className={buttonVariants({ variant: "outline" })}
            >
              <Upload className="h-4 w-4" />
              Importer un CSV
            </Link>
            <Link
              href="/persons/bulk"
              className={buttonVariants({ variant: "outline" })}
            >
              <LayoutGrid className="h-4 w-4" />
              Saisie multiple
            </Link>
            <Link href="/persons/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" />
              Nouvelle personne
            </Link>
          </>
        }
      />

      {createdCount > 0 && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-brand/30 bg-brand-subtle/50 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span>
            {createdCount} personne{createdCount > 1 ? "s" : ""} ajoutée
            {createdCount > 1 ? "s" : ""} à l&apos;arbre.
          </span>
        </div>
      )}

      {persons.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-16 text-center">
          <p className="text-muted-foreground mb-4">
            Aucune personne dans cet arbre pour le moment.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/persons/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" />
              Ajouter la première
            </Link>
            <Link
              href="/persons/bulk"
              className={buttonVariants({ variant: "outline" })}
            >
              <LayoutGrid className="h-4 w-4" />
              Saisie multiple
            </Link>
          </div>
        </div>
      ) : (
        <PersonsTable persons={rows} />
      )}
    </main>
  );
}
