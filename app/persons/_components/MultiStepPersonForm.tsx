"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countryCodeByName,
  DEFAULT_COUNTRY_CODE,
} from "@/lib/countries";
import { displayNameSurnameFirst } from "@/lib/person-display";
import {
  PersonCombobox,
  type PersonOption,
} from "@/components/person-combobox";
import { EventPlaceInput } from "./EventPlaceInput";

const inputSelectClass =
  "flex h-9 w-full rounded-lg border border-input bg-surface px-3 py-1 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/40";

const textareaClass =
  "flex w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/40";

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

const emptyPerson: PersonInit = {
  givenName: null,
  surname: null,
  marriedName: null,
  nickname: null,
  sex: "UNKNOWN",
  isLiving: false,
  notes: null,
};

function isoDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

type StepDef = {
  key: "identity" | "life" | "family" | "notes";
  title: string;
  description: string;
};

export function MultiStepPersonForm({
  action,
  person = emptyPerson,
  birth = null,
  death = null,
  parentAId = null,
  parentBId = null,
  otherPersons,
  showParents = true,
  siblingOf = null,
  childOfFamilyId = null,
  parentOf = null,
  parentsHint = null,
  cancelHref = "/persons",
  submitLabel = "Enregistrer",
}: {
  action: (formData: FormData) => void | Promise<void>;
  person?: PersonInit;
  birth?: EventInit;
  death?: EventInit;
  parentAId?: string | null;
  parentBId?: string | null;
  otherPersons: PersonOption[];
  showParents?: boolean;
  siblingOf?: string | null;
  childOfFamilyId?: string | null;
  parentOf?: string | null;
  parentsHint?: React.ReactNode;
  cancelHref?: string;
  submitLabel?: string;
}) {
  const steps: StepDef[] = useMemo(
    () =>
      [
        {
          key: "identity",
          title: "Identité",
          description: "Nom, sexe, et statut de vie",
        },
        {
          key: "life",
          title: "Vie",
          description: "Dates et lieux de naissance et décès",
        },
        showParents && {
          key: "family",
          title: "Famille",
          description: "Parents (les frères et sœurs sont dérivés)",
        },
        {
          key: "notes",
          title: "Notes",
          description: "Informations complémentaires",
        },
      ].filter(Boolean) as StepDef[],
    [showParents],
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [isLiving, setIsLiving] = useState(person.isLiving);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);

  // Lookup by id for the children chips display.
  const personById = useMemo(() => {
    const m = new Map<string, PersonOption>();
    for (const p of otherPersons) m.set(p.id, p);
    return m;
  }, [otherPersons]);

  // Ids the child picker must not offer: already picked, or a parent.
  const excludedChildIds = useMemo(
    () =>
      [...selectedChildIds, parentAId, parentBId].filter(
        (v): v is string => Boolean(v),
      ),
    [selectedChildIds, parentAId, parentBId],
  );

  const current = steps[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  const birthCountryCode =
    countryCodeByName(birth?.place?.country) ?? DEFAULT_COUNTRY_CODE;
  const deathCountryCode =
    countryCodeByName(death?.place?.country) ?? DEFAULT_COUNTRY_CODE;

  return (
    <form action={action} className="space-y-8" noValidate>
      {siblingOf && (
        <input type="hidden" name="siblingOf" defaultValue={siblingOf} />
      )}
      {childOfFamilyId && (
        <input
          type="hidden"
          name="childOfFamily"
          defaultValue={childOfFamilyId}
        />
      )}
      {parentOf && (
        <input type="hidden" name="parentOf" defaultValue={parentOf} />
      )}

      <StepIndicator
        steps={steps}
        current={stepIdx}
        onJump={(i) => setStepIdx(i)}
      />

      <div>
        <h2 className="text-lg font-semibold tracking-tight">{current.title}</h2>
        <p className="text-sm text-muted-foreground">{current.description}</p>
      </div>

      <Card hidden={current.key !== "identity"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prénoms" htmlFor="givenName">
            <Input
              id="givenName"
              name="givenName"
              defaultValue={person.givenName ?? ""}
              autoFocus={
                person.givenName === null && person.surname === null
              }
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

        <div className="grid grid-cols-2 gap-4 items-end pt-2">
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
          <label className="flex items-center gap-2 h-9 select-none cursor-pointer">
            <input
              type="checkbox"
              name="isLiving"
              checked={isLiving}
              onChange={(e) => setIsLiving(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">Vivant·e</span>
          </label>
        </div>
      </Card>

      <div hidden={current.key !== "life"} className="space-y-6">
        <Card>
          <SectionHeader title="Naissance" />
          <Field label="Date" htmlFor="birth.date">
            <Input
              type="date"
              id="birth.date"
              name="birth.date"
              defaultValue={isoDate(birth?.date)}
              className="max-w-xs"
            />
          </Field>
          <EventPlaceInput
            fieldPrefix="birth"
            defaultPlaceText={birth?.place?.name ?? ""}
            defaultCountryCode={birthCountryCode}
          />
        </Card>

        <Card hidden={isLiving}>
          <SectionHeader title="Décès" />
          <Field label="Date" htmlFor="death.date">
            <Input
              type="date"
              id="death.date"
              name="death.date"
              defaultValue={isoDate(death?.date)}
              className="max-w-xs"
            />
          </Field>
          <EventPlaceInput
            fieldPrefix="death"
            defaultPlaceText={death?.place?.name ?? ""}
            defaultCountryCode={deathCountryCode}
          />
        </Card>

        {isLiving && (
          <p className="text-xs text-muted-foreground italic">
            La section &laquo;&nbsp;Décès&nbsp;&raquo; est masquée puisque la
            personne est marquée comme vivante.
          </p>
        )}
      </div>

      {showParents && (
        <div hidden={current.key !== "family"} className="space-y-6">
          <Card>
            <SectionHeader title="Parents" />
            {parentsHint && (
              <p className="text-xs text-muted-foreground -mt-2">
                {parentsHint}
              </p>
            )}
            {otherPersons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune autre personne disponible pour l&apos;instant.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Parent 1" htmlFor="parentAId">
                  <PersonCombobox
                    id="parentAId"
                    name="parentAId"
                    persons={otherPersons}
                    defaultPerson={personById.get(parentAId ?? "") ?? null}
                    excludeIds={parentBId ? [parentBId] : undefined}
                    placeholder="Tape un nom…"
                  />
                </Field>
                <Field label="Parent 2" htmlFor="parentBId">
                  <PersonCombobox
                    id="parentBId"
                    name="parentBId"
                    persons={otherPersons}
                    defaultPerson={personById.get(parentBId ?? "") ?? null}
                    excludeIds={parentAId ? [parentAId] : undefined}
                    placeholder="Tape un nom…"
                  />
                </Field>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Enfants existants à rattacher" />
            <p className="text-xs text-muted-foreground -mt-2">
              Sélectionne ici les personnes déjà créées que tu veux rattacher
              comme enfants. Ne pas confondre avec la création d&apos;un
              nouvel enfant : utilise le bouton « + Enfant » sur une union
              pour ça.
            </p>
            {otherPersons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune autre personne disponible.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 min-h-[2.25rem]">
                  {selectedChildIds.length === 0 && (
                    <span className="text-sm text-muted-foreground italic pt-1">
                      Aucun enfant sélectionné.
                    </span>
                  )}
                  {selectedChildIds.map((id) => {
                    const p = personById.get(id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 pl-2.5 pr-1 py-1 text-sm"
                      >
                        <input
                          type="hidden"
                          name="childIds"
                          defaultValue={id}
                        />
                        <span>
                          {p ? displayNameSurnameFirst(p) : "(personne)"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedChildIds((cur) =>
                              cur.filter((x) => x !== id),
                            );
                          }}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                          aria-label={`Retirer ${p ? displayNameSurnameFirst(p) : "cet enfant"}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>

                <PersonCombobox
                  persons={otherPersons}
                  excludeIds={excludedChildIds}
                  clearOnSelect
                  onSelect={(p) =>
                    setSelectedChildIds((cur) =>
                      cur.includes(p.id) ? cur : [...cur, p.id],
                    )
                  }
                  placeholder="Chercher une personne à rattacher…"
                  emptyMessage="Plus aucune personne à ajouter"
                />
                <p className="text-[11px] text-muted-foreground">
                  Comportement : si l&apos;enfant n&apos;a pas de famille de
                  naissance, il sera rattaché à cette personne. S&apos;il a
                  déjà un parent enregistré, cette personne sera ajoutée
                  comme second parent.
                </p>
              </>
            )}
          </Card>
        </div>
      )}

      <Card hidden={current.key !== "notes"}>
        <Field label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            rows={6}
            defaultValue={person.notes ?? ""}
            placeholder="Profession, anecdotes, sources de recherche…"
            className={textareaClass}
          />
        </Field>
      </Card>

      <div className="flex items-center justify-between gap-3 pt-4 border-t">
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Annuler
        </Link>
        <div className="flex gap-2">
          {/* Native <button type=button> for navigation — guarantees no
              form submission regardless of any wrapper component behavior. */}
          <button
            type="button"
            disabled={isFirst}
            onClick={(e) => {
              e.preventDefault();
              setStepIdx((s) => Math.max(0, s - 1));
            }}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </button>
          {isLast ? (
            <Button type="submit">{submitLabel}</Button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setStepIdx((s) => Math.min(steps.length - 1, s + 1));
              }}
              className={cn(buttonVariants())}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function StepIndicator({
  steps,
  current,
  onJump,
}: {
  steps: StepDef[];
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="flex items-center justify-between">
      {steps.map((s, i) => (
        <Fragment key={s.key}>
          <li className="flex flex-col items-center min-w-0">
            <button
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                i === current && "bg-primary text-primary-foreground",
                i < current && "bg-primary/15 text-primary",
                i > current && "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              aria-current={i === current ? "step" : undefined}
              aria-label={`Étape ${i + 1} : ${s.title}`}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </button>
            <span
              className={cn(
                "mt-1.5 text-xs",
                i === current
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {s.title}
            </span>
          </li>
          {i < steps.length - 1 && (
            <li
              aria-hidden
              className={cn(
                "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                i < current ? "bg-primary/40" : "bg-border",
              )}
            />
          )}
        </Fragment>
      ))}
    </ol>
  );
}

function Card({
  children,
  hidden,
}: {
  children: React.ReactNode;
  hidden?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 space-y-4 shadow-sm",
        hidden && "hidden",
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
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
