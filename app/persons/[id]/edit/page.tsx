import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import { updatePerson } from "../actions";
import { DeleteButton } from "../../_components/DeleteButton";
import { PersonForm } from "../../_components/PersonForm";

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { person } = await requirePersonForCurrentUser(id);

  const events = await prisma.event.findMany({
    where: { personId: id, type: { in: ["BIRTH", "DEATH"] } },
    include: { place: true },
  });
  const birth = events.find((e) => e.type === "BIRTH");
  const death = events.find((e) => e.type === "DEATH");

  const familyChild = await prisma.familyChild.findFirst({
    where: { childId: id },
    include: {
      family: {
        include: {
          children: {
            include: { child: true },
            orderBy: { child: { surname: "asc" } },
          },
        },
      },
    },
  });
  const family = familyChild?.family ?? null;
  const siblings =
    family?.children.filter((fc) => fc.childId !== id) ?? [];

  const otherPersons = await prisma.person.findMany({
    where: { treeId: person.treeId, NOT: { id } },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    select: { id: true, givenName: true, surname: true },
  });

  return (
    <main className="min-h-screen max-w-3xl mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/persons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour à la liste
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/persons/${person.id}/tree`}
            className="text-sm text-primary hover:underline"
          >
            Voir l&apos;arbre →
          </Link>
          <DeleteButton id={person.id} label={displayName(person)} />
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        {displayName(person)}
      </h1>

      <PersonForm
        action={updatePerson.bind(null, person.id)}
        person={{
          givenName: person.givenName,
          surname: person.surname,
          marriedName: person.marriedName,
          nickname: person.nickname,
          sex: person.sex,
          isLiving: person.isLiving,
          notes: person.notes,
        }}
        birth={
          birth
            ? {
                date: birth.date,
                place: birth.place
                  ? {
                      name: birth.place.name,
                      country: birth.place.country,
                    }
                  : null,
              }
            : null
        }
        death={
          death
            ? {
                date: death.date,
                place: death.place
                  ? {
                      name: death.place.name,
                      country: death.place.country,
                    }
                  : null,
              }
            : null
        }
        parentAId={family?.spouseAId ?? null}
        parentBId={family?.spouseBId ?? null}
        otherPersons={otherPersons}
        showParents={true}
        cancelHref="/persons"
      />

      <section className="mt-8 rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Frères et sœurs
          </h2>
          <Link
            href={`/persons/new?siblingOf=${person.id}`}
            className="text-sm text-primary hover:underline"
          >
            + Ajouter
          </Link>
        </div>
        {siblings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {family
              ? "Aucun frère ni sœur enregistré."
              : "Les frères et sœurs apparaîtront ici dès qu'au moins un parent ou un frère/sœur sera défini."}
          </p>
        ) : (
          <ul className="rounded-md border divide-y bg-background">
            {siblings.map((fc) => (
              <li key={fc.id}>
                <Link
                  href={`/persons/${fc.child.id}/edit`}
                  className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span>{displayName(fc.child)}</span>
                  <span className="text-xs text-muted-foreground">
                    Modifier →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
