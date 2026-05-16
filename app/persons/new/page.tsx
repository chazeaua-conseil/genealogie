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
  searchParams: Promise<{ siblingOf?: string; childOfFamily?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { siblingOf, childOfFamily } = await searchParams;
  const tree = await getOrCreateDefaultTree(session.user.id);

  const siblingRef = siblingOf
    ? await prisma.person.findFirst({
        where: { id: siblingOf, treeId: tree.id },
      })
    : null;

  const family = childOfFamily
    ? await prisma.family.findFirst({
        where: { id: childOfFamily, treeId: tree.id },
        include: {
          spouseA: { select: { id: true, givenName: true, surname: true } },
          spouseB: { select: { id: true, givenName: true, surname: true } },
        },
      })
    : null;

  const otherPersons = await prisma.person.findMany({
    where: { treeId: tree.id },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    select: { id: true, givenName: true, surname: true },
  });

  const familyParentNames = family
    ? [family.spouseA, family.spouseB]
        .filter((s): s is { id: string; givenName: string | null; surname: string | null } => Boolean(s))
        .map(displayName)
        .join(" & ")
    : "";

  const backHref = family
    ? `/persons/${family.spouseA?.id ?? family.spouseB?.id ?? ""}/edit`
    : siblingRef
      ? `/persons/${siblingRef.id}/edit`
      : "/persons";

  const heading = family
    ? `Nouvel enfant de ${familyParentNames || "(parents inconnus)"}`
    : siblingRef
      ? `Nouveau frère/sœur de ${displayName(siblingRef)}`
      : "Nouvelle personne";

  const subheading = family
    ? "Les parents seront automatiquement attachés à cette union. Tu peux toujours les modifier plus tard depuis la fiche de l'enfant."
    : siblingRef
      ? `Les parents seront automatiquement hérités de la famille de ${displayName(siblingRef)}.`
      : null;

  const submitLabel = family
    ? "Créer l'enfant"
    : siblingRef
      ? "Créer le frère/sœur"
      : "Créer la personne";

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
          {heading}
        </h1>
        {subheading && (
          <p className="text-sm text-muted-foreground mt-1.5">{subheading}</p>
        )}
      </div>

      <MultiStepPersonForm
        action={createPerson}
        otherPersons={otherPersons}
        showParents={!siblingRef && !family}
        siblingOf={siblingRef?.id ?? null}
        childOfFamilyId={family?.id ?? null}
        cancelHref={backHref}
        submitLabel={submitLabel}
      />
    </main>
  );
}
