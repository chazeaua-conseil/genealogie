import Link from "next/link";
import { Network, Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import { updatePerson } from "../actions";
import { DeleteButton } from "../../_components/DeleteButton";
import { MultiStepPersonForm } from "../../_components/MultiStepPersonForm";
import { buttonVariants } from "@/components/ui/button";
import {
  displayName,
  displayNameSurnameFirst,
} from "@/lib/person-display";

function shortDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR").format(d);
}

const familyTypeLabel: Record<
  "MARRIAGE" | "UNION" | "RELIGIOUS" | "OTHER",
  string
> = {
  MARRIAGE: "Mariage",
  UNION: "Union libre",
  RELIGIOUS: "Mariage religieux",
  OTHER: "Union",
};

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
  const familyOfBirth = familyChild?.family ?? null;
  const siblings =
    familyOfBirth?.children.filter((fc) => fc.childId !== id) ?? [];

  // All unions where this person is a spouse, with their marriage/divorce
  // events and partner identity.
  const unions = await prisma.family.findMany({
    where: {
      treeId: person.treeId,
      OR: [{ spouseAId: id }, { spouseBId: id }],
    },
    include: {
      spouseA: { select: { id: true, givenName: true, surname: true } },
      spouseB: { select: { id: true, givenName: true, surname: true } },
      events: {
        where: { type: { in: ["MARRIAGE", "DIVORCE"] } },
        include: { place: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Children = anyone listed as a child in a family where this person is a
  // spouse (across all unions and pre/post separations).
  const childLinks = await prisma.familyChild.findMany({
    where: {
      family: {
        OR: [{ spouseAId: id }, { spouseBId: id }],
      },
    },
    include: {
      child: {
        include: {
          events: {
            where: { type: { in: ["BIRTH", "DEATH"] } },
            select: { type: true, date: true },
          },
        },
      },
      family: {
        select: {
          spouseA: { select: { id: true, givenName: true, surname: true } },
          spouseB: { select: { id: true, givenName: true, surname: true } },
        },
      },
    },
  });
  childLinks.sort((a, b) => {
    const ay =
      a.child.events.find((e) => e.type === "BIRTH")?.date?.getFullYear() ?? 0;
    const by =
      b.child.events.find((e) => e.type === "BIRTH")?.date?.getFullYear() ?? 0;
    return ay - by;
  });

  const otherPersons = await prisma.person.findMany({
    where: { treeId: person.treeId, NOT: { id } },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    select: { id: true, givenName: true, surname: true },
  });

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
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
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Network className="h-4 w-4 mr-1.5" />
            Voir l&apos;arbre
          </Link>
          <DeleteButton id={person.id} label={displayName(person)} />
        </div>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight mb-8">
        {displayName(person)}
      </h1>

      <MultiStepPersonForm
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
                  ? { name: birth.place.name, country: birth.place.country }
                  : null,
              }
            : null
        }
        death={
          death
            ? {
                date: death.date,
                place: death.place
                  ? { name: death.place.name, country: death.place.country }
                  : null,
              }
            : null
        }
        parentAId={familyOfBirth?.spouseAId ?? null}
        parentBId={familyOfBirth?.spouseBId ?? null}
        otherPersons={otherPersons}
        showParents
        cancelHref="/persons"
      />

      <RelationsSection title="Unions">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs text-muted-foreground">
            Mariages et unions libres avec date de séparation éventuelle.
          </p>
          <Link
            href={`/persons/${person.id}/unions/new`}
            className="text-sm text-primary hover:underline inline-flex items-center"
          >
            <Plus className="h-3.5 w-3.5 mr-0.5" />
            Ajouter
          </Link>
        </div>
        {unions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune union enregistrée.
          </p>
        ) : (
          <ul className="rounded-md border divide-y bg-background">
            {unions.map((u) => {
              const partner =
                u.spouseAId === person.id ? u.spouseB : u.spouseA;
              const marriageEv = u.events.find((e) => e.type === "MARRIAGE");
              const divorceEv = u.events.find((e) => e.type === "DIVORCE");
              return (
                <li
                  key={u.id}
                  className="flex items-stretch divide-x hover:bg-muted/50"
                >
                  <Link
                    href={`/persons/${person.id}/unions/${u.id}/edit`}
                    className="flex items-center justify-between px-3 py-3 text-sm gap-3 flex-1 min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {familyTypeLabel[u.type]}
                        {partner ? ` avec ${displayNameSurnameFirst(partner)}` : " (partenaire inconnu)"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {marriageEv?.date && (
                          <span>Le {shortDate(marriageEv.date)}</span>
                        )}
                        {marriageEv?.place?.name && (
                          <span>{marriageEv.date ? " · " : ""}{marriageEv.place.name}</span>
                        )}
                        {!marriageEv?.date && !marriageEv?.place?.name && (
                          <span className="italic">Aucune date ni lieu enregistrés</span>
                        )}
                        {divorceEv && (
                          <span className="ml-1">
                            · Divorce {divorceEv.date ? `le ${shortDate(divorceEv.date)}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                  <Link
                    href={`/persons/new?childOfFamily=${u.id}`}
                    className="flex items-center px-3 py-3 text-xs text-primary hover:underline shrink-0"
                    title="Ajouter un enfant à cette union"
                  >
                    <Plus className="h-3.5 w-3.5 mr-0.5" />
                    Enfant
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </RelationsSection>

      <RelationsSection title="Enfants">
        {childLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun enfant rattaché.{" "}
            <span className="text-xs">
              Définis cette personne comme parent depuis la fiche de l&apos;enfant.
            </span>
          </p>
        ) : (
          <ul className="rounded-md border divide-y bg-background">
            {childLinks.map((cl) => {
              const otherParent =
                cl.family.spouseA?.id === person.id
                  ? cl.family.spouseB
                  : cl.family.spouseA;
              const birthY = cl.child.events
                .find((e) => e.type === "BIRTH")
                ?.date?.getFullYear();
              return (
                <li key={cl.id}>
                  <Link
                    href={`/persons/${cl.child.id}/edit`}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {displayNameSurnameFirst(cl.child)}
                        {birthY ? (
                          <span className="text-xs text-muted-foreground font-normal ml-2">
                            ({birthY})
                          </span>
                        ) : null}
                      </div>
                      {otherParent && (
                        <div className="text-xs text-muted-foreground truncate">
                          avec {displayNameSurnameFirst(otherParent)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Modifier →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </RelationsSection>

      <RelationsSection title="Frères et sœurs">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs text-muted-foreground">
            Personnes rattachées à la même famille de naissance.
          </p>
          <Link
            href={`/persons/new?siblingOf=${person.id}`}
            className="text-sm text-primary hover:underline inline-flex items-center"
          >
            <Plus className="h-3.5 w-3.5 mr-0.5" />
            Ajouter
          </Link>
        </div>
        {siblings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {familyOfBirth
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
                  <span>{displayNameSurnameFirst(fc.child)}</span>
                  <span className="text-xs text-muted-foreground">
                    Modifier →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RelationsSection>
    </main>
  );
}

function RelationsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}
