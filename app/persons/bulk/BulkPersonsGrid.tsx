"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, Rows3, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import { createPersonsBatch } from "./actions";
import { BULK_IDLE } from "./types";

type Sex = "MALE" | "FEMALE" | "UNKNOWN";

type Row = {
  key: string;
  surname: string;
  givenName: string;
  sex: Sex;
  isLiving: boolean;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
};

/** Column order used when pasting a block from a spreadsheet. */
const PASTE_COLUMNS = [
  "surname",
  "givenName",
  "sex",
  "birthDate",
  "birthPlace",
  "deathDate",
  "deathPlace",
] as const;

type PasteField = (typeof PASTE_COLUMNS)[number];

const INITIAL_ROWS = 5;

let keySeed = 0;
function emptyRow(surname = ""): Row {
  keySeed += 1;
  return {
    key: `row-${keySeed}`,
    surname,
    givenName: "",
    sex: "UNKNOWN",
    isLiving: false,
    birthDate: "",
    birthPlace: "",
    deathDate: "",
    deathPlace: "",
  };
}

function parseSexText(v: string): Sex {
  const s = v.trim().toUpperCase();
  if (["M", "H", "MALE", "MASCULIN", "HOMME", "GARÇON"].includes(s))
    return "MALE";
  if (["F", "FEMALE", "FÉMININ", "FEMININ", "FEMME", "FILLE"].includes(s))
    return "FEMALE";
  return "UNKNOWN";
}

const cellClass =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-input focus:border-ring focus:bg-surface focus:ring-3 focus:ring-ring/40";

/**
 * Spreadsheet-style grid for entering several people at once. Rows can be
 * pasted straight from Excel / Numbers (tab-separated), Enter walks down a
 * column, and empty rows are ignored on save.
 */
export function BulkPersonsGrid() {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => emptyRow()),
  );
  const [state, formAction, pending] = useActionState(
    createPersonsBatch,
    BULK_IDLE,
  );
  const gridRef = useRef<HTMLDivElement>(null);

  const filledCount = rows.filter(
    (r) =>
      r.surname.trim() ||
      r.givenName.trim() ||
      r.birthDate.trim() ||
      r.birthPlace.trim() ||
      r.deathDate.trim() ||
      r.deathPlace.trim(),
  ).length;

  const rowErrorByIndex = new Map(
    (state.rowErrors ?? []).map((e) => [e.row, e.message]),
  );

  const update = useCallback(
    (index: number, patch: Partial<Row>) => {
      setRows((cur) =>
        cur.map((r, i) => (i === index ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  function addRows(count: number) {
    setRows((cur) => {
      // Carry the last surname down: consecutive rows are usually siblings.
      const lastSurname = cur[cur.length - 1]?.surname ?? "";
      return [...cur, ...Array.from({ length: count }, () => emptyRow(lastSurname))];
    });
  }

  function removeRow(index: number) {
    setRows((cur) =>
      cur.length === 1 ? [emptyRow()] : cur.filter((_, i) => i !== index),
    );
  }

  function focusCell(row: number, col: number) {
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-cell="${row}-${col}"]`,
    );
    el?.focus();
  }

  function onCellKeyDown(
    e: React.KeyboardEvent<HTMLElement>,
    row: number,
    col: number,
  ) {
    if (e.key !== "Enter") return;
    // Enter walks down the column instead of submitting the form — a grid
    // this size is almost always filled column by column.
    e.preventDefault();
    if (row === rows.length - 1) addRows(1);
    requestAnimationFrame(() => focusCell(row + 1, col));
  }

  function onCellPaste(
    e: React.ClipboardEvent<HTMLElement>,
    row: number,
    col: number,
  ) {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t\n]/.test(text)) return; // plain single value: default paste
    e.preventDefault();

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    setRows((cur) => {
      const next = [...cur];
      lines.forEach((line, r) => {
        const target = row + r;
        while (next.length <= target) next.push(emptyRow());
        const draft = { ...next[target] };
        line.split("\t").forEach((cell, c) => {
          const field: PasteField | undefined = PASTE_COLUMNS[col + c];
          if (!field) return;
          if (field === "sex") draft.sex = parseSexText(cell);
          else draft[field] = cell.trim();
        });
        next[target] = draft;
      });
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="countryCode">Pays des lieux saisis</Label>
          <select
            id="countryCode"
            name="countryCode"
            defaultValue={DEFAULT_COUNTRY_CODE}
            className="flex h-9 w-56 rounded-lg border border-input bg-surface px-3 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground max-w-sm">
          Dates au format <code>JJ/MM/AAAA</code>, <code>AAAA-MM-JJ</code> ou{" "}
          <code>AAAA</code> pour une année seule. Tu peux coller directement
          un bloc de cellules depuis un tableur.
        </p>
      </div>

      {state.status === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-2.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-destructive">{state.message}</p>
              {state.rowErrors && state.rowErrors.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {state.rowErrors.map((err) => (
                    <li key={`${err.row}-${err.message}`}>
                      Ligne {err.row} — {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={gridRef}
        className="overflow-x-auto rounded-xl border bg-card shadow-sm scrollbar-slim"
      >
        <table className="w-full min-w-[62rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="w-8 py-2 pl-3 text-xs font-medium text-muted-foreground">
                #
              </th>
              <HeadCell className="w-44">Nom</HeadCell>
              <HeadCell className="w-44">Prénoms</HeadCell>
              <HeadCell className="w-28">Sexe</HeadCell>
              <HeadCell className="w-28">Naissance</HeadCell>
              <HeadCell className="w-40">Lieu de naissance</HeadCell>
              <HeadCell className="w-28">Décès</HeadCell>
              <HeadCell className="w-40">Lieu de décès</HeadCell>
              <HeadCell className="w-16">Vivant·e</HeadCell>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const error = rowErrorByIndex.get(i + 1);
              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b last:border-0",
                    error && "bg-destructive/5",
                  )}
                  title={error}
                >
                  <td className="py-1 pl-3 text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </td>
                  <TextCell
                    value={row.surname}
                    onChange={(v) => update(i, { surname: v })}
                    placeholder={i === 0 ? "CHAZEAU" : undefined}
                    cell={`${i}-0`}
                    onKeyDown={(e) => onCellKeyDown(e, i, 0)}
                    onPaste={(e) => onCellPaste(e, i, 0)}
                    className="font-medium"
                  />
                  <TextCell
                    value={row.givenName}
                    onChange={(v) => update(i, { givenName: v })}
                    placeholder={i === 0 ? "Jean Baptiste" : undefined}
                    cell={`${i}-1`}
                    onKeyDown={(e) => onCellKeyDown(e, i, 1)}
                    onPaste={(e) => onCellPaste(e, i, 1)}
                  />
                  <td className="p-0">
                    <select
                      data-cell={`${i}-2`}
                      value={row.sex}
                      onChange={(e) =>
                        update(i, { sex: e.target.value as Sex })
                      }
                      onKeyDown={(e) => onCellKeyDown(e, i, 2)}
                      className={cn(cellClass, "cursor-pointer")}
                    >
                      <option value="UNKNOWN">—</option>
                      <option value="MALE">Masculin</option>
                      <option value="FEMALE">Féminin</option>
                    </select>
                    <input type="hidden" name="row.sex" value={row.sex} />
                  </td>
                  <TextCell
                    value={row.birthDate}
                    onChange={(v) => update(i, { birthDate: v })}
                    placeholder={i === 0 ? "1897" : undefined}
                    cell={`${i}-3`}
                    onKeyDown={(e) => onCellKeyDown(e, i, 3)}
                    onPaste={(e) => onCellPaste(e, i, 3)}
                    className="tabular-nums"
                  />
                  <TextCell
                    value={row.birthPlace}
                    onChange={(v) => update(i, { birthPlace: v })}
                    placeholder={i === 0 ? "Aurillac" : undefined}
                    cell={`${i}-4`}
                    onKeyDown={(e) => onCellKeyDown(e, i, 4)}
                    onPaste={(e) => onCellPaste(e, i, 4)}
                  />
                  <TextCell
                    value={row.deathDate}
                    onChange={(v) => update(i, { deathDate: v })}
                    placeholder={i === 0 ? "12/05/1962" : undefined}
                    cell={`${i}-5`}
                    onKeyDown={(e) => onCellKeyDown(e, i, 5)}
                    onPaste={(e) => onCellPaste(e, i, 5)}
                    className="tabular-nums"
                    disabled={row.isLiving}
                  />
                  <TextCell
                    value={row.deathPlace}
                    onChange={(v) => update(i, { deathPlace: v })}
                    placeholder={i === 0 ? "Paris" : undefined}
                    cell={`${i}-6`}
                    onKeyDown={(e) => onCellKeyDown(e, i, 6)}
                    onPaste={(e) => onCellPaste(e, i, 6)}
                    disabled={row.isLiving}
                  />
                  <td className="px-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.isLiving}
                      onChange={(e) => update(i, { isLiving: e.target.checked })}
                      className="h-4 w-4 accent-primary align-middle"
                      aria-label={`Ligne ${i + 1} : personne vivante`}
                    />
                    {row.isLiving && (
                      <input type="hidden" name="row.isLiving" value="on" />
                    )}
                    {!row.isLiving && (
                      <input type="hidden" name="row.isLiving" value="" />
                    )}
                  </td>
                  <td className="px-1">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                      aria-label={`Supprimer la ligne ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => addRows(1)}>
            <Plus className="h-4 w-4" />
            Ajouter une ligne
          </Button>
          <Button type="button" variant="ghost" onClick={() => addRows(5)}>
            <Rows3 className="h-4 w-4" />5 lignes
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {filledCount} ligne{filledCount > 1 ? "s" : ""} à enregistrer
          </span>
          <Link href="/persons" className={buttonVariants({ variant: "ghost" })}>
            Annuler
          </Link>
          <Button type="submit" disabled={pending || filledCount === 0}>
            <Save className="h-4 w-4" />
            {pending ? "Enregistrement…" : "Enregistrer tout"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function HeadCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-2 py-2 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function TextCell({
  value,
  onChange,
  placeholder,
  cell,
  onKeyDown,
  onPaste,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  cell: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}) {
  const name = `row.${cellField(cell)}`;
  return (
    <td className="p-0">
      <input
        type="text"
        data-cell={cell}
        name={name}
        value={disabled ? "" : value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(cellClass, className, disabled && "opacity-40")}
      />
      {/* Disabled inputs are not submitted — keep the column aligned. */}
      {disabled && <input type="hidden" name={name} value="" />}
    </td>
  );
}

function cellField(cell: string): PasteField {
  const col = Number(cell.split("-")[1]);
  return PASTE_COLUMNS[col];
}
