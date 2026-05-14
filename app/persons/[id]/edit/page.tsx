import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import { updatePerson } from "../actions";
import { DeleteButton } from "./DeleteButton";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const dateQualifierOptions = [
  { value: "EXACT", label: "Exacte" },
  { value: "ABOUT", label: "Vers" },
  { value: "BEFORE", label: "Avant" },
  { value: "AFTER", label: "Après" },
  { value: "BETWEEN", label: "Entre" },
  { value: "ESTIMATED", label: "Estimée" },
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

function isoDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

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

  // Birth + death events
  const events = await prisma.event.findMany({
    where: { personId: id, type: { in: ["BIRTH", "DEATH"] } },
    include: { place: true },
  });
  const birth = events.find((e) => e.type === "BIRTH");
  const death = events.find((e) => e.type === "DEATH");

  // All other persons in the tree (for parent pickers)
  const otherPersons = await prisma.person.findMany({
    where: { treeId: person.treeId, NOT: { id } },
    orderBy: [{ surname: "asc" }, { givenName: "asc" }],
    select: { id: true, givenName: true, surname: true, sex: true },
  });

  // Find this person's family of birth (if any) — gives us the current parents
  // and siblings.
  const familyChild = await prisma.familyChild.findFirst({
    where: { childId: id },
    include: {
      family: {
        include: {
          spouseA: true,
          spouseB: true,
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

  return (
    <main className="min-h-screen max-w-2xl mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/persons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour à la liste
        </Link>
        <DeleteButton id={person.id} label={displayName(person)} />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        {displayName(person)}
      </h1>

      <form action={updatePerson.bind(null, person.id)} className="space-y-8">
        {/* Identité */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Identité
          </h2>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="prefix">Titre</Label>
              <Input
                id="prefix"
                name="prefix"
                placeholder="M., Mme, Dr…"
                defaultValue={person.prefix ?? ""}
              />
            </div>
            <div className="col-span-6 space-y-1.5">
              <Label htmlFor="givenName">Prénoms</Label>
              <Input
                id="givenName"
                name="givenName"
                defaultValue={person.givenName ?? ""}
              />
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="suffix">Suffixe</Label>
              <Input
                id="suffix"
                name="suffix"
                placeholder="Jr, Sr…"
                defaultValue={person.suffix ?? ""}
              />
            </div>

            <div className="col-span-6 space-y-1.5">
              <Label htmlFor="surname">Nom de famille</Label>
              <Input
                id="surname"
                name="surname"
                defaultValue={person.surname ?? ""}
              />
            </div>
            <div className="col-span-6 space-y-1.5">
              <Label htmlFor="marriedName">Nom marital / d&apos;usage</Label>
              <Input
                id="marriedName"
                name="marriedName"
                defaultValue={person.marriedName ?? ""}
              />
            </div>

            <div className="col-span-12 space-y-1.5">
              <Label htmlFor="nickname">Surnom</Label>
              <Input
                id="nickname"
                name="nickname"
                defaultValue={person.nickname ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sex">Sexe</Label>
              <select
                id="sex"
                name="sex"
                defaultValue={person.sex}
                className={selectClass}
              >
                <option value="MALE">Masculin</option>
                <option value="FEMALE">Féminin</option>
                <option value="UNKNOWN">Inconnu</option>
              </select>
            </div>
            <label className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                name="isLiving"
                defaultChecked={person.isLiving}
                className="h-4 w-4"
              />
              <span className="text-sm">Vivant·e</span>
            </label>
            <label className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                name="privacy"
                defaultChecked={person.privacy}
                className="h-4 w-4"
              />
              <span className="text-sm">Vie privée</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={person.notes ?? ""}
              placeholder="Profession, anecdotes, sources de recherche…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            />
          </div>
        </section>

        {/* Naissance */}
        <EventSection
          title="Naissance"
          prefix="birth"
          date={birth?.date ?? null}
          dateEnd={birth?.dateEnd ?? null}
          dateQualifier={birth?.dateQualifier ?? "EXACT"}
          dateText={birth?.dateText ?? ""}
          placeText={birth?.place?.name ?? ""}
        />

        {/* Décès */}
        <EventSection
          title="Décès"
          prefix="death"
          date={death?.date ?? null}
          dateEnd={death?.dateEnd ?? null}
          dateQualifier={death?.dateQualifier ?? "EXACT"}
          dateText={death?.dateText ?? ""}
          placeText={death?.place?.name ?? ""}
        />

        {/* Parents */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Parents
          </h2>
          {otherPersons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crée d&apos;abord d&apos;autres personnes pour pouvoir les
              rattacher comme parents.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ParentSelect
                name="parentAId"
                label="Parent 1"
                currentId={family?.spouseAId ?? null}
                persons={otherPersons}
              />
              <ParentSelect
                name="parentBId"
                label="Parent 2"
                currentId={family?.spouseBId ?? null}
                persons={otherPersons}
              />
            </div>
          )}
        </section>

        {/* Frères et sœurs (read-only ici, ajout via lien) */}
        <section className="space-y-3">
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
                : "Les frères et sœurs apparaîtront ici une fois qu'au moins un parent est défini."}
            </p>
          ) : (
            <ul className="rounded-md border divide-y">
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
          <p className="text-xs text-muted-foreground">
            L&apos;ajout d&apos;un frère/sœur crée une nouvelle personne liée à
            la même famille que toi. Si tu n&apos;as pas encore de parents
            définis, une famille vide est créée pour vous regrouper.
          </p>
        </section>

        <div className="flex gap-3 border-t pt-6">
          <Button type="submit">Enregistrer</Button>
          <Link
            href="/persons"
            className={buttonVariants({ variant: "ghost" })}
          >
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}

function ParentSelect({
  name,
  label,
  currentId,
  persons,
}: {
  name: string;
  label: string;
  currentId: string | null;
  persons: Array<{
    id: string;
    givenName: string | null;
    surname: string | null;
    sex: "MALE" | "FEMALE" | "UNKNOWN";
  }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={currentId ?? ""}
        className={selectClass}
      >
        <option value="">— Aucun —</option>
        {persons.map((p) => (
          <option key={p.id} value={p.id}>
            {displayName(p)}
          </option>
        ))}
      </select>
    </div>
  );
}

function EventSection({
  title,
  prefix,
  date,
  dateEnd,
  dateQualifier,
  dateText,
  placeText,
}: {
  title: string;
  prefix: "birth" | "death";
  date: Date | null;
  dateEnd: Date | null;
  dateQualifier: string;
  dateText: string;
  placeText: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-3 space-y-1.5">
          <Label htmlFor={`${prefix}.dateQualifier`}>Précision</Label>
          <select
            id={`${prefix}.dateQualifier`}
            name={`${prefix}.dateQualifier`}
            defaultValue={dateQualifier}
            className={selectClass}
          >
            {dateQualifierOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-4 space-y-1.5">
          <Label htmlFor={`${prefix}.date`}>Date</Label>
          <Input
            type="date"
            id={`${prefix}.date`}
            name={`${prefix}.date`}
            defaultValue={isoDate(date)}
          />
        </div>
        <div className="col-span-4 space-y-1.5">
          <Label htmlFor={`${prefix}.dateEnd`}>Date de fin (Entre…)</Label>
          <Input
            type="date"
            id={`${prefix}.dateEnd`}
            name={`${prefix}.dateEnd`}
            defaultValue={isoDate(dateEnd)}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-5 space-y-1.5">
          <Label htmlFor={`${prefix}.dateText`}>Date libre</Label>
          <Input
            id={`${prefix}.dateText`}
            name={`${prefix}.dateText`}
            placeholder='ex. "été 1850", "an III"'
            defaultValue={dateText}
          />
        </div>
        <div className="col-span-7 space-y-1.5">
          <Label>Lieu</Label>
          <PlaceAutocomplete fieldPrefix={prefix} defaultValue={placeText} />
        </div>
      </div>
    </section>
  );
}
