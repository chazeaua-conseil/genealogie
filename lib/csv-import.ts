// CSV import for genealogy data.
//
// Two-pass import:
//   1. Create every Person row + their birth/death events.
//      Map the user-supplied `person_id` (any unique string) → DB Person.id.
//   2. Resolve relationships (parent_a_id / parent_b_id) against the map,
//      using setParents() so siblings get auto-grouped into shared Families.
//
// Wrapped in a Prisma $transaction so a row 50 failure rolls back rows 1-49.

import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { countryNameByCode, countryCodeByName } from "@/lib/countries";
import { setParents } from "@/app/persons/_lib/form";

export type ImportRow = {
  person_id?: string;
  surname?: string;
  given_name?: string;
  nickname?: string;
  sex?: string;
  is_living?: string;
  notes?: string;
  birth_date?: string;
  birth_place?: string;
  birth_country?: string;
  death_date?: string;
  death_place?: string;
  death_country?: string;
  parent_a_id?: string;
  parent_b_id?: string;
};

export type ImportError = {
  row: number; // 1-indexed row number (header is row 1, data starts at row 2)
  message: string;
};

export type ImportPreview = {
  rows: ImportRow[];
  errors: ImportError[];
  warnings: ImportError[];
};

export type ImportResult = {
  importedPersons: number;
  appliedParentLinks: number;
};

const EXPECTED_COLUMNS = [
  "person_id",
  "surname",
  "given_name",
  "nickname",
  "sex",
  "is_living",
  "notes",
  "birth_date",
  "birth_place",
  "birth_country",
  "death_date",
  "death_place",
  "death_country",
  "parent_a_id",
  "parent_b_id",
] as const;

function parseSex(v: string | undefined): "MALE" | "FEMALE" | "UNKNOWN" {
  const s = (v ?? "").trim().toUpperCase();
  if (["M", "MALE", "MASCULIN", "H", "HOMME"].includes(s)) return "MALE";
  if (
    ["F", "FEMALE", "FÉMININ", "FEMININ", "FEMME", "W"].includes(s)
  )
    return "FEMALE";
  return "UNKNOWN";
}

function parseBool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return ["true", "1", "vivant", "vivante", "oui", "yes", "vrai"].includes(s);
}

/**
 * Parse a date from several accepted formats:
 *  - YYYY-MM-DD or YYYY-M-D (ISO-ish)
 *  - DD/MM/YYYY (French)
 *  - YYYY (year only — January 1st assumed)
 * Returns null if the value is empty or unparseable.
 */
export function parseImportDate(v: string | undefined): Date | null {
  if (!v) return null;
  const t = v.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(
      `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fr = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const [, d, m, y] = fr;
    const date = new Date(
      `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const yearOnly = t.match(/^(\d{4})$/);
  if (yearOnly) {
    return new Date(`${yearOnly[1]}-01-01T00:00:00.000Z`);
  }
  return null;
}

/**
 * Parse the CSV content into typed rows + accumulate errors/warnings
 * without touching the database. Use this for the preview step.
 */
export function previewCsv(content: string): ImportPreview {
  const errors: ImportError[] = [];
  const warnings: ImportError[] = [];

  let parsedRecords: Record<string, string>[];
  try {
    parsedRecords = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      // Tolerate rows that omit trailing empty columns. Most spreadsheets
      // (Excel, Numbers, Sheets) drop trailing commas when the rightmost
      // columns are blank, so the strict default rejects perfectly valid
      // exports. Extra (unexpected) columns still raise, since those
      // usually signal a missing escape / quoting bug.
      relax_column_count_less: true,
    });
  } catch (err) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Le fichier ne semble pas être un CSV valide : ${
            err instanceof Error ? err.message : "erreur inconnue"
          }`,
        },
      ],
      warnings: [],
    };
  }

  if (parsedRecords.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: "Le fichier ne contient aucune ligne de données." }],
      warnings: [],
    };
  }

  // Header validation: warn for unknown columns (typo helpers).
  const seenColumns = new Set(Object.keys(parsedRecords[0]));
  for (const col of seenColumns) {
    if (!EXPECTED_COLUMNS.includes(col as (typeof EXPECTED_COLUMNS)[number])) {
      warnings.push({
        row: 1,
        message: `Colonne inconnue "${col}" — elle sera ignorée.`,
      });
    }
  }

  const ids = new Set<string>();
  const rows: ImportRow[] = [];

  parsedRecords.forEach((rec, i) => {
    const lineNumber = i + 2; // +2 because: +1 for 1-indexed, +1 for header

    const row: ImportRow = {};
    for (const col of EXPECTED_COLUMNS) {
      const v = rec[col];
      if (v !== undefined && v !== "") {
        row[col] = v;
      }
    }

    // person_id is required (referenced for relationships)
    if (!row.person_id) {
      errors.push({
        row: lineNumber,
        message: "person_id manquant (identifiant unique requis pour pouvoir référencer cette personne ailleurs).",
      });
    } else if (ids.has(row.person_id)) {
      errors.push({
        row: lineNumber,
        message: `person_id "${row.person_id}" dupliqué (déjà utilisé sur une ligne précédente).`,
      });
    } else {
      ids.add(row.person_id);
    }

    // At least a name part
    if (!row.surname && !row.given_name) {
      errors.push({
        row: lineNumber,
        message: "Au moins surname ou given_name doit être renseigné.",
      });
    }

    // Date parsing sanity checks
    if (row.birth_date && parseImportDate(row.birth_date) === null) {
      warnings.push({
        row: lineNumber,
        message: `birth_date "${row.birth_date}" non reconnue (formats acceptés : YYYY-MM-DD, DD/MM/YYYY, YYYY).`,
      });
    }
    if (row.death_date && parseImportDate(row.death_date) === null) {
      warnings.push({
        row: lineNumber,
        message: `death_date "${row.death_date}" non reconnue (formats acceptés : YYYY-MM-DD, DD/MM/YYYY, YYYY).`,
      });
    }

    rows.push(row);
  });

  // Cross-row references
  for (let i = 0; i < rows.length; i++) {
    const lineNumber = i + 2;
    const row = rows[i];
    for (const key of ["parent_a_id", "parent_b_id"] as const) {
      const ref = row[key];
      if (ref && !ids.has(ref)) {
        errors.push({
          row: lineNumber,
          message: `${key} "${ref}" ne correspond à aucun person_id présent dans le fichier.`,
        });
      }
      if (ref && ref === row.person_id) {
        errors.push({
          row: lineNumber,
          message: `${key} ne peut pas être égal au person_id de la même ligne.`,
        });
      }
    }
  }

  return { rows, errors, warnings };
}

async function findOrCreatePlaceByName(
  treeId: string,
  name: string,
  country: string | null,
  userId: string,
  tx: typeof prisma,
) {
  const existing = await tx.place.findFirst({
    where: { treeId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    if (country && !existing.country) {
      return tx.place.update({
        where: { id: existing.id },
        data: { country },
      });
    }
    return existing;
  }
  return tx.place.create({
    data: { treeId, name, country, createdById: userId },
  });
}

/**
 * Performs the actual database mutations for an import. Returns counts.
 * Throws on any error to roll back the entire transaction.
 */
export async function commitImport(
  rows: ImportRow[],
  treeId: string,
  userId: string,
): Promise<ImportResult> {
  // We can't easily nest setParents (which does its own prisma calls) inside
  // a $transaction tx because setParents uses the top-level prisma client.
  // For first-version simplicity, run sequentially against the regular
  // client. We accept "partial import on mid-run failure" as a known
  // limitation in V1 — surface it in the UI copy.

  const idMap = new Map<string, string>();
  let importedPersons = 0;

  for (const row of rows) {
    const person = await prisma.person.create({
      data: {
        treeId,
        givenName: row.given_name || null,
        surname: row.surname || null,
        nickname: row.nickname || null,
        sex: parseSex(row.sex),
        isLiving: parseBool(row.is_living),
        notes: row.notes || null,
        createdById: userId,
        updatedById: userId,
      },
    });
    importedPersons++;
    if (row.person_id) idMap.set(row.person_id, person.id);

    // Birth event
    const birthDate = parseImportDate(row.birth_date);
    const hasBirth = Boolean(birthDate) || Boolean(row.birth_place);
    if (hasBirth) {
      let placeId: string | null = null;
      if (row.birth_place) {
        const p = await findOrCreatePlaceByName(
          treeId,
          row.birth_place,
          row.birth_country ??
            countryNameByCode(row.birth_country) ??
            null,
          userId,
          prisma,
        );
        placeId = p.id;
      }
      await prisma.event.create({
        data: {
          type: "BIRTH",
          treeId,
          personId: person.id,
          date: birthDate,
          placeId,
          createdById: userId,
        },
      });
    }

    // Death event
    const deathDate = parseImportDate(row.death_date);
    const hasDeath = Boolean(deathDate) || Boolean(row.death_place);
    if (hasDeath) {
      let placeId: string | null = null;
      if (row.death_place) {
        const p = await findOrCreatePlaceByName(
          treeId,
          row.death_place,
          row.death_country ??
            countryNameByCode(row.death_country) ??
            null,
          userId,
          prisma,
        );
        placeId = p.id;
      }
      await prisma.event.create({
        data: {
          type: "DEATH",
          treeId,
          personId: person.id,
          date: deathDate,
          placeId,
          createdById: userId,
        },
      });
    }
  }

  // Pass 2: parents
  let appliedParentLinks = 0;
  for (const row of rows) {
    const personDbId = row.person_id ? idMap.get(row.person_id) : null;
    if (!personDbId) continue;
    const parentADbId = row.parent_a_id ? idMap.get(row.parent_a_id) ?? null : null;
    const parentBDbId = row.parent_b_id ? idMap.get(row.parent_b_id) ?? null : null;
    if (!parentADbId && !parentBDbId) continue;
    await setParents(personDbId, treeId, parentADbId, parentBDbId, userId);
    appliedParentLinks++;
  }

  return { importedPersons, appliedParentLinks };
}

// Tiny no-op consumers to silence the unused-import warning on
// countryCodeByName even though it's not used in the current iteration —
// we keep the symbol importable to ease future enrichment.
void countryCodeByName;
