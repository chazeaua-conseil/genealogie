import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { createPerson } from "../actions";
import { MultiStepPersonForm } from "../_components/MultiStepPersonForm";

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ siblingOf?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { siblingOf } = await searchParams;
  const tree = await getOrCreateDefaultTree(session.user.id);

  const siblingRef = siblingOf
    ? await prisma.person.findFirst({
        where: { id: siblingOf, treeId: tree.id },
      })
    : null;

  const otherPersons = await prisma.person.findMany({
    where: { treeId: tree.id },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    select: { id: true, givenName: true, surname: true },
  });

  const backHref = siblingRef ? `/persons/${siblingRef.id}/edit` : "/persons";

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">
          {siblingRef
            ? `Nouveau frère/sœur de ${displayName(siblingRef)}`
            : "Nouvelle personne"}
        </h1>
        {siblingRef && (
          <p className="text-sm text-muted-foreground mt-1.5">
            Les parents seront automatiquement hérités de la famille de{" "}
            {displayName(siblingRef)}.
          </p>
        )}
      </div>

      <MultiStepPersonForm
        action={createPerson}
        otherPersons={otherPersons}
        showParents={!siblingRef}
        siblingOf={siblingRef?.id ?? null}
        cancelHref={backHref}
        submitLabel={
          siblingRef ? "Créer le frère/sœur" : "Créer la personne"
        }
      />
    </main>
  );
}
