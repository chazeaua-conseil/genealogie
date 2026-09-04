import Link from "next/link";
import { requirePersonForCurrentUser } from "@/lib/access";
import { loadPersonOptions } from "@/lib/person-options";
import { PageHeader } from "@/components/page-header";
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

  const partners = await loadPersonOptions(person.treeId, { excludeId: id });

  const backHref = `/persons/${person.id}/edit`;

  return (
    <main className="container mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <PageHeader
        backHref={backHref}
        backLabel={`Retour à ${displayName(person)}`}
        eyebrow="Union"
        title={`Nouvelle union de ${displayName(person)}`}
        description="Choisis le partenaire, la nature de l'union et les dates. Tu pourras revenir l'éditer à tout moment."
      />

      {partners.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
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
