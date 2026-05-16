"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countryCodeByName,
  DEFAULT_COUNTRY_CODE,
} from "@/lib/countries";
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

const emptyPerson: PersonInit = {
  givenName: null,
  surname: null,
  marriedName: null,
  nickname: null,
  sex: "UNKNOWN",
  isLiving: false,
  notes: null,
};

function displayName(p: PersonSelect) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

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
  childOfFamilyId?: string | null;
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

  const current = steps[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  const birthCountryCode =
    countryCodeByName(birth?.place?.country) ?? DEFAULT_COUNTRY_CODE;
  const deathCountryCode =
    countryCodeByName(death?.place?.country) ?? DEFAULT_COUNTRY_CODE;

  return (
    <form action={action} className="space-y-8">
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
        <Card hidden={current.key !== "family"}>
          {otherPersons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crée d&apos;abord d&apos;autres personnes pour pouvoir les
              rattacher comme parents.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Parent 1" htmlFor="parentAId">
                <select
                  id="parentAId"
                  name="parentAId"
                  defaultValue={parentAId ?? ""}
                  className={inputSelectClass}
                >
                  <option value="">— Aucun —</option>
                  {otherPersons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Parent 2" htmlFor="parentBId">
                <select
                  id="parentBId"
                  name="parentBId"
                  defaultValue={parentBId ?? ""}
                  className={inputSelectClass}
                >
                  <option value="">— Aucun —</option>
                  {otherPersons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </Card>
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
          <Button
            type="button"
            variant="outline"
            disabled={isFirst}
            onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Button>
          {isLast ? (
            <Button type="submit">{submitLabel}</Button>
          ) : (
            <Button
              type="button"
              onClick={() => setStepIdx((s) => Math.min(steps.length - 1, s + 1))}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
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
                "flex-1 h-px mx-2",
                i < current ? "bg-primary/30" : "bg-muted",
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
        "rounded-lg border bg-card p-5 space-y-4 shadow-sm",
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
