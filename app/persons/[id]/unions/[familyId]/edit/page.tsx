import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  requireFamilyForCurrentUser,
  requirePersonForCurrentUser,
} from "@/lib/access";
import { UnionForm } from "../../../../_components/UnionForm";
import { DeleteUnionButton } from "../../../../_components/DeleteUnionButton";
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

  const partners = await prisma.person.findMany({
    where: { treeId: person.treeId, NOT: { id } },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    select: { id: true, givenName: true, surname: true },
  });

  const backHref = `/persons/${person.id}/edit`;

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link
            href={backHref}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Retour à {displayName(person)}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">
            Union de {displayName(person)}
            {partner ? ` & ${displayName(partner)}` : ""}
          </h1>
        </div>
        <DeleteUnionButton
          personId={person.id}
          familyId={family.id}
          partnerLabel={partner ? displayName(partner) : "(inconnu)"}
        />
      </div>

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
