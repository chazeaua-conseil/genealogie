"use client";

import { useState } from "react";
import Link from "next/link";
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

type PersonSelect = {
  id: string;
  givenName: string | null;
  surname: string | null;
};

type EventInit = {
  date: Date | null;
  place: { name: string; country: string | null } | null;
} | null;

function displayName(p: PersonSelect) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

function isoDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

const familyTypeOptions: Array<{
  value: "MARRIAGE" | "UNION" | "RELIGIOUS" | "OTHER";
  label: string;
}> = [
  { value: "MARRIAGE", label: "Mariage civil" },
  { value: "UNION", label: "Union libre" },
  { value: "RELIGIOUS", label: "Mariage religieux" },
  { value: "OTHER", label: "Autre" },
];

export function UnionForm({
  action,
  partnerId = null,
  type = "MARRIAGE",
  marriage = null,
  isDivorced = false,
  divorce = null,
  partners,
  cancelHref,
  submitLabel = "Enregistrer",
}: {
  action: (formData: FormData) => void | Promise<void>;
  partnerId?: string | null;
  type?: "MARRIAGE" | "UNION" | "RELIGIOUS" | "OTHER";
  marriage?: EventInit;
  isDivorced?: boolean;
  divorce?: EventInit;
  partners: PersonSelect[];
  cancelHref: string;
  submitLabel?: string;
}) {
  const [divorced, setDivorced] = useState(isDivorced);

  const marriageCountry =
    countryCodeByName(marriage?.place?.country) ?? DEFAULT_COUNTRY_CODE;
  const divorceCountry =
    countryCodeByName(divorce?.place?.country) ?? DEFAULT_COUNTRY_CODE;

  return (
    <form action={action} className="space-y-6" noValidate>
      <Card>
        <SectionHeader title="Partenaire" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Partenaire" htmlFor="partnerId">
            <select
              id="partnerId"
              name="partnerId"
              defaultValue={partnerId ?? ""}
              required
              className={inputSelectClass}
            >
              <option value="" disabled>
                — Choisir une personne —
              </option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nature de l'union" htmlFor="type">
            <select
              id="type"
              name="type"
              defaultValue={type}
              className={inputSelectClass}
            >
              {familyTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Mariage / union" />
        <Field label="Date" htmlFor="marriage.date">
          <Input
            type="date"
            id="marriage.date"
            name="marriage.date"
            defaultValue={isoDate(marriage?.date)}
            className="max-w-xs"
          />
        </Field>
        <EventPlaceInput
          fieldPrefix="marriage"
          defaultPlaceText={marriage?.place?.name ?? ""}
          defaultCountryCode={marriageCountry}
        />
      </Card>

      <Card>
        <label className="flex items-center gap-2 select-none cursor-pointer">
          <input
            type="checkbox"
            name="isDivorced"
            checked={divorced}
            onChange={(e) => setDivorced(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium">
            Divorcé·e·s ou séparé·e·s
          </span>
        </label>

        <div className={cn("space-y-4 pt-2", !divorced && "hidden")}>
          <Field label="Date du divorce / de la séparation" htmlFor="divorce.date">
            <Input
              type="date"
              id="divorce.date"
              name="divorce.date"
              defaultValue={isoDate(divorce?.date)}
              className="max-w-xs"
            />
          </Field>
          <EventPlaceInput
            fieldPrefix="divorce"
            defaultPlaceText={divorce?.place?.name ?? ""}
            defaultCountryCode={divorceCountry}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 pt-4 border-t">
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Annuler
        </Link>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </h2>
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
