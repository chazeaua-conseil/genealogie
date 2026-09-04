import { prisma } from "@/lib/prisma";
import {
  requireFamilyForCurrentUser,
  requirePersonForCurrentUser,
} from "@/lib/access";
import { loadPersonOptions } from "@/lib/person-options";
import { UnionForm } from "../../../../_components/UnionForm";
import { DeleteUnionButton } from "../../../../_components/DeleteUnionButton";
import { PageHeader } from "@/components/page-header";
import { updateUnion } from "../../actions";

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

export default async function EditUnionPage({
  params,
}: {
  params: Promise<{ id: string; familyId: string }>;
}) {
  const { id, familyId } = await params;
  const { person } = await requirePersonForCurrentUser(id);
  await requireFamilyForCurrentUser(familyId, person.id);

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      events: {
        where: { type: { in: ["MARRIAGE", "DIVORCE"] } },
        include: { place: true },
      },
      spouseA: { select: { id: true, givenName: true, surname: true } },
      spouseB: { select: { id: true, givenName: true, surname: true } },
    },
  });
  if (!family) return null;

  const marriage = family.events.find((e) => e.type === "MARRIAGE");
  const divorce = family.events.find((e) => e.type === "DIVORCE");

  const partner =
    family.spouseAId === person.id ? family.spouseB : family.spouseA;
  const partnerId = partner?.id ?? null;

  const partners = await loadPersonOptions(person.treeId, { excludeId: id });

  const backHref = `/persons/${person.id}/edit`;

  return (
    <main className="container mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <PageHeader
        backHref={backHref}
        backLabel={`Retour à ${displayName(person)}`}
        eyebrow="Union"
        title={`${displayName(person)}${partner ? ` & ${displayName(partner)}` : ""}`}
        actions={
          <DeleteUnionButton
            personId={person.id}
            familyId={family.id}
            partnerLabel={partner ? displayName(partner) : "(inconnu)"}
          />
        }
      />

      <UnionForm
        action={updateUnion.bind(null, person.id, family.id)}
        partnerId={partnerId}
        type={family.type}
        marriage={
          marriage
            ? {
                date: marriage.date,
                place: marriage.place
                  ? {
                      name: marriage.place.name,
                      country: marriage.place.country,
                    }
                  : null,
              }
            : null
        }
        isDivorced={Boolean(divorce)}
        divorce={
          divorce
            ? {
                date: divorce.date,
                place: divorce.place
                  ? {
                      name: divorce.place.name,
                      country: divorce.place.country,
                    }
                  : null,
              }
            : null
        }
        partners={partners}
        cancelHref={backHref}
        submitLabel="Enregistrer"
      />
    </main>
  );
}
