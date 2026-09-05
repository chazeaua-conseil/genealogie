"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTree } from "@/lib/tree";
import { parseImportDate } from "@/lib/csv-import";
import { EMPTY_EVENT_INPUT, upsertEvent, type EventInput } from "../_lib/form";
import type { BulkRowError, BulkState } from "./types";

type ParsedRow = {
  index: number;
  surname: string | null;
  givenName: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  isLiving: boolean;
  birthDate: Date | null;
  birthPlace: string | null;
  deathDate: Date | null;
  deathPlace: string | null;
};

function column(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((v) => v.toString().trim());
}

function orNull(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length === 0 ? null : t;
}

function eventInput(
  date: Date | null,
  placeText: string | null,
  countryCode: string | null,
): EventInput {
  return {
    ...EMPTY_EVENT_INPUT,
    // upsertEvent re-parses the date, so hand it back an unambiguous ISO day.
    date: date ? date.toISOString().slice(0, 10) : null,
    placeText,
    placeCountryCode: placeText ? countryCode : null,
  };
}

/**
 * Creates every filled-in row of the bulk grid in one go. Validation runs
 * over all rows first: a single bad date stops the whole batch rather than
 * leaving a half-imported grid behind.
 */
export async function createPersonsBatch(
  _prev: BulkState,
  formData: FormData,
): Promise<BulkState> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "Non authentifié." };
  const userId = session.user.id;

  const surnames = column(formData, "row.surname");
  const givenNames = column(formData, "row.givenName");
  const sexes = column(formData, "row.sex");
  const livings = column(formData, "row.isLiving");
  const birthDates = column(formData, "row.birthDate");
  const birthPlaces = column(formData, "row.birthPlace");
  const deathDates = column(formData, "row.deathDate");
  const deathPlaces = column(formData, "row.deathPlace");
  const countryCode = orNull(formData.get("countryCode")?.toString());

  const rowErrors: BulkRowError[] = [];
  const rows: ParsedRow[] = [];

  for (let i = 0; i < surnames.length; i++) {
    const surname = orNull(surnames[i]);
    const givenName = orNull(givenNames[i]);
    const birthRaw = orNull(birthDates[i]);
    const deathRaw = orNull(deathDates[i]);
    const birthPlace = orNull(birthPlaces[i]);
    const deathPlace = orNull(deathPlaces[i]);
    const isLiving = livings[i] === "on";

    // A row is "empty" when nothing at all was typed — skipped silently so
    // spare rows at the bottom of the grid don't need to be removed.
    const isEmpty =
      !surname &&
      !givenName &&
      !birthRaw &&
      !deathRaw &&
      !birthPlace &&
      !deathPlace;
    if (isEmpty) continue;

    if (!surname && !givenName) {
      rowErrors.push({
        row: i + 1,
        message: "Renseigne au moins le nom ou le prénom.",
      });
      continue;
    }

    const birthDate = birthRaw ? parseImportDate(birthRaw) : null;
    if (birthRaw && !birthDate) {
      rowErrors.push({
        row: i + 1,
        message: `Date de naissance illisible : « ${birthRaw} ». Formats acceptés : JJ/MM/AAAA, AAAA-MM-JJ ou AAAA.`,
      });
    }
    const deathDate = deathRaw ? parseImportDate(deathRaw) : null;
    if (deathRaw && !deathDate) {
      rowErrors.push({
        row: i + 1,
        message: `Date de décès illisible : « ${deathRaw} ». Formats acceptés : JJ/MM/AAAA, AAAA-MM-JJ ou AAAA.`,
      });
    }

    rows.push({
      index: i + 1,
      surname,
      givenName,
      sex:
        sexes[i] === "MALE" || sexes[i] === "FEMALE"
          ? (sexes[i] as "MALE" | "FEMALE")
          : "UNKNOWN",
      isLiving,
      birthDate,
      birthPlace,
      deathDate,
      deathPlace,
    });
  }

  if (rowErrors.length > 0) {
    return {
      status: "error",
      message: "Corrige les lignes signalées avant d'enregistrer.",
      rowErrors,
    };
  }
  if (rows.length === 0) {
    return { status: "error", message: "Aucune ligne à enregistrer." };
  }

  const tree = await getOrCreateDefaultTree(userId);

  for (const row of rows) {
    const person = await prisma.person.create({
      data: {
        treeId: tree.id,
        givenName: row.givenName,
        surname: row.surname,
        sex: row.sex,
        isLiving: row.isLiving,
        createdById: userId,
        updatedById: userId,
      },
    });

    await upsertEvent(
      person.id,
      tree.id,
      userId,
      "BIRTH",
      eventInput(row.birthDate, row.birthPlace, countryCode),
    );
    if (!row.isLiving) {
      await upsertEvent(
        person.id,
        tree.id,
        userId,
        "DEATH",
        eventInput(row.deathDate, row.deathPlace, countryCode),
      );
    }
  }

  revalidatePath("/persons");
  revalidatePath("/");
  redirect(`/persons?created=${rows.length}`);
}
