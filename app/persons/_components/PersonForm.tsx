import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countryCodeByName,
  DEFAULT_COUNTRY_CODE,
} from "@/lib/countries";
import { DeceasedToggle } from "./DeceasedToggle";
import { EventPlaceInput } from "./EventPlaceInput";

const inputSelectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

const textareaClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs";

type PersonInit = {
  givenName: string | null;
  surname: string | null;
  marriedName: string | null;
  nickname: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  isLiving: boolean;
  notes: string | null;
};

type EventInit = {
  date: Date | null;
  place: {
    name: string;
    country: string | null;
  } | null;
} | null;

type PersonSelect = {
  id: string;
  givenName: string | null;
  surname: string | null;
};

function displayName(p: PersonSelect): string {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

function isoDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

const empty: PersonInit = {
  givenName: null,
  surname: null,
  marriedName: null,
  nickname: null,
  sex: "UNKNOWN",
  isLiving: false,
  notes: null,
};

export function PersonForm({
  action,
  person = empty,
  birth = null,
  death = null,
  parentAId = null,
  parentBId = null,
  otherPersons,
  showParents = true,
  siblingOf = null,
  cancelHref = "/persons",
  submitLabel = "Enregistrer",
}: {
  action: (formData: FormData) => void | Promise<void>;
  person?: PersonInit;
  birth?: EventInit;
  death?: EventInit;
  parentAId?: string | null;
  parentBId?: string | null;
  otherPersons: PersonSelect[];
  showParents?: boolean;
  siblingOf?: string | null;
  cancelHref?: string;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="space-y-6">
      {siblingOf && <input type="hidden" name="siblingOf" value={siblingOf} />}

      <Section title="Identité">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénoms" htmlFor="givenName">
            <Input
              id="givenName"
              name="givenName"
              defaultValue={person.givenName ?? ""}
              autoFocus={person.givenName === null && person.surname === null}
            />
          </Field>
          <Field label="Nom de famille" htmlFor="surname">
            <Input
              id="surname"
              name="surname"
              defaultValue={person.surname ?? ""}
            />
          </Field>
          <Field label="Nom marital / d'usage" htmlFor="marriedName">
            <Input
              id="marriedName"
              name="marriedName"
              defaultValue={person.marriedName ?? ""}
            />
          </Field>
          <Field label="Surnom" htmlFor="nickname">
            <Input
              id="nickname"
              name="nickname"
              defaultValue={person.nickname ?? ""}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <Field label="Sexe" htmlFor="sex">
            <select
              id="sex"
              name="sex"
              defaultValue={person.sex}
              className={inputSelectClass}
            >
              <option value="MALE">Masculin</option>
              <option value="FEMALE">Féminin</option>
              <option value="UNKNOWN">Inconnu</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 h-9">
            <input
              type="checkbox"
              name="isLiving"
              defaultChecked={person.isLiving}
              className="h-4 w-4"
            />
            <span className="text-sm">Vivant·e</span>
          </label>
        </div>
      </Section>

      <EventCard title="Naissance" prefix="birth" event={birth} />
      <DeceasedToggle defaultIsLiving={person.isLiving}>
        <EventCard title="Décès" prefix="death" event={death} />
      </DeceasedToggle>

      {showParents && (
        <Section title="Parents">
          {otherPersons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crée d&apos;abord d&apos;autres personnes pour pouvoir les
              rattacher comme parents.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <ParentSelect
                name="parentAId"
                label="Parent 1"
                currentId={parentAId}
                persons={otherPersons}
              />
              <ParentSelect
                name="parentBId"
                label="Parent 2"
                currentId={parentBId}
                persons={otherPersons}
              />
            </div>
          )}
        </Section>
      )}

      <Section title="Notes">
        <textarea
          name="notes"
          rows={4}
          defaultValue={person.notes ?? ""}
          placeholder="Profession, anecdotes, sources de recherche…"
          className={textareaClass}
        />
      </Section>

      <div className="flex gap-3 pt-2">
        <Button type="submit">{submitLabel}</Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Annuler
        </Link>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
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
  persons: PersonSelect[];
}) {
  return (
    <Field label={label} htmlFor={name}>
      <select
        id={name}
        name={name}
        defaultValue={currentId ?? ""}
        className={inputSelectClass}
      >
        <option value="">— Aucun —</option>
        {persons.map((p) => (
          <option key={p.id} value={p.id}>
            {displayName(p)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function EventCard({
  title,
  prefix,
  event,
}: {
  title: string;
  prefix: "birth" | "death";
  event: EventInit;
}) {
  const placeText = event?.place?.name ?? "";
  const placeCountryCode =
    countryCodeByName(event?.place?.country) ?? DEFAULT_COUNTRY_CODE;

  return (
    <Section title={title}>
      <Field label="Date" htmlFor={`${prefix}.date`}>
        <Input
          type="date"
          id={`${prefix}.date`}
          name={`${prefix}.date`}
          defaultValue={isoDate(event?.date ?? null)}
          className="max-w-xs"
        />
      </Field>
      <EventPlaceInput
        fieldPrefix={prefix}
        defaultPlaceText={placeText}
        defaultCountryCode={placeCountryCode}
      />
    </Section>
  );
}
