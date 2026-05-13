import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePersonForCurrentUser } from "@/lib/access";
import { updatePerson } from "../actions";
import { DeleteButton } from "./DeleteButton";
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

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

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

        <div className="flex gap-3 pt-2 border-t pt-6">
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
          <Label htmlFor={`${prefix}.placeText`}>Lieu</Label>
          <Input
            id={`${prefix}.placeText`}
            name={`${prefix}.placeText`}
            placeholder="Commune, département, pays"
            defaultValue={placeText}
          />
          <p className="text-xs text-muted-foreground">
            Saisie libre pour l&apos;instant — l&apos;autocomplétion via OSM
            arrive dans le slice suivant.
          </p>
        </div>
      </div>
    </section>
  );
}
