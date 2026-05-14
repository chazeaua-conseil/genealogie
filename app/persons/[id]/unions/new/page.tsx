import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import { UnionForm } from "../../../_components/UnionForm";
import { createUnion } from "../actions";

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

export default async function NewUnionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { person } = await requirePersonForCurrentUser(id);

  const partners = await prisma.person.findMany({
    where: { treeId: person.treeId, NOT: { id } },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    select: { id: true, givenName: true, surname: true },
  });

  const backHref = `/persons/${person.id}/edit`;

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour à {displayName(person)}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">
          Nouvelle union de {displayName(person)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Choisis le partenaire, la nature de l&apos;union et les dates. Tu
          pourras revenir l&apos;éditer à tout moment.
        </p>
      </div>

      {partners.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <p>
            Aucune autre personne dans l&apos;arbre — crée d&apos;abord un
            partenaire avant de pouvoir enregistrer une union.
          </p>
          <Link
            href="/persons/new"
            className="text-primary hover:underline mt-3 inline-block"
          >
            Créer une nouvelle personne
          </Link>
        </div>
      ) : (
        <UnionForm
          action={createUnion.bind(null, person.id)}
          partners={partners}
          cancelHref={backHref}
          submitLabel="Créer l'union"
        />
      )}
    </main>
  );
}
