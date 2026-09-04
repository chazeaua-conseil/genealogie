import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { loadPersonOptions } from "@/lib/person-options";
import { createPerson } from "../actions";
import { PageHeader } from "@/components/page-header";
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
  searchParams: Promise<{
    siblingOf?: string;
    childOfFamily?: string;
    parentOf?: string;
    role?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { siblingOf, childOfFamily, parentOf, role } = await searchParams;
  const tree = await getOrCreateDefaultTree(session.user.id);

  const siblingRef = siblingOf
    ? await prisma.person.findFirst({
        where: { id: siblingOf, treeId: tree.id },
      })
    : null;

  // Creating the father / mother of an existing person, from their fiche.
  const childRef = parentOf
    ? await prisma.person.findFirst({
        where: { id: parentOf, treeId: tree.id },
        select: { id: true, givenName: true, surname: true },
      })
    : null;
  const parentRole: "father" | "mother" | null = childRef
    ? role === "father"
      ? "father"
      : role === "mother"
        ? "mother"
        : null
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

  const otherPersons = await loadPersonOptions(tree.id, {
    excludeId: childRef?.id,
  });

  const familyParentNames = family
    ? [family.spouseA, family.spouseB]
        .filter((s): s is { id: string; givenName: string | null; surname: string | null } => Boolean(s))
        .map(displayName)
        .join(" & ")
    : "";

  const parentRoleLabel =
    parentRole === "father" ? "père" : parentRole === "mother" ? "mère" : "parent";

  const backHref = childRef
    ? `/persons/${childRef.id}/edit`
    : family
      ? `/persons/${family.spouseA?.id ?? family.spouseB?.id ?? ""}/edit`
      : siblingRef
        ? `/persons/${siblingRef.id}/edit`
        : "/persons";

  const heading = childRef
    ? parentRole === "mother"
      ? `Nouvelle mère de ${displayName(childRef)}`
      : `Nouveau ${parentRoleLabel} de ${displayName(childRef)}`
    : family
      ? `Nouvel enfant de ${familyParentNames || "(parents inconnus)"}`
      : siblingRef
        ? `Nouveau frère/sœur de ${displayName(siblingRef)}`
        : "Nouvelle personne";

  const subheading = childRef
    ? `Cette personne sera rattachée comme ${parentRoleLabel} de ${displayName(childRef)}. Les frères et sœurs déjà rattachés à la même famille en hériteront aussi.`
    : family
      ? "Les parents seront automatiquement attachés à cette union. Tu peux toujours les modifier plus tard depuis la fiche de l'enfant."
      : siblingRef
        ? `Les parents seront automatiquement hérités de la famille de ${displayName(siblingRef)}.`
        : null;

  const submitLabel = childRef
    ? parentRole === "mother"
      ? "Créer la mère"
      : parentRole === "father"
        ? "Créer le père"
        : "Créer le parent"
    : family
      ? "Créer l'enfant"
      : siblingRef
        ? "Créer le frère/sœur"
        : "Créer la personne";

  // Sensible defaults for a parent: the sex implied by the role, and — for a
  // father — the child's surname, which is the common case in French records.
  const personInit = childRef
    ? {
        givenName: null,
        surname: parentRole === "father" ? childRef.surname : null,
        marriedName: null,
        nickname: null,
        sex:
          parentRole === "father"
            ? ("MALE" as const)
            : parentRole === "mother"
              ? ("FEMALE" as const)
              : ("UNKNOWN" as const),
        isLiving: false,
        notes: null,
      }
    : undefined;

  return (
    <main className="container mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <PageHeader
        backHref={backHref}
        title={heading}
        description={subheading}
      />

      <MultiStepPersonForm
        action={createPerson}
        person={personInit}
        otherPersons={otherPersons}
        showParents={!siblingRef && !family}
        siblingOf={siblingRef?.id ?? null}
        childOfFamilyId={family?.id ?? null}
        parentOf={childRef?.id ?? null}
        cancelHref={backHref}
        submitLabel={submitLabel}
      />
    </main>
  );
}
