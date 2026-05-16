// Display helpers for Person rendering. Two name formats are used across
// the app:
//   - displayName        : "Jean Chazeau" (natural French order, used for
//                          headings, breadcrumbs, full-sentence contexts)
//   - displayNameSurnameFirst : "CHAZEAU Jean" (used in lists / dropdowns
//                               where the surname is the primary sort key)

export type PersonNamed = {
  givenName: string | null;
  surname: string | null;
};

export function displayName(p: PersonNamed): string {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

export function displayNameSurnameFirst(p: PersonNamed): string {
  const surname = p.surname?.trim() ?? "";
  const givenName = p.givenName?.trim() ?? "";
  if (!surname && !givenName) return "(sans nom)";
  if (!surname) return givenName;
  if (!givenName) return surname.toUpperCase();
  return `${surname.toUpperCase()} ${givenName}`;
}

export const NO_SURNAME_KEY = "(Sans nom de famille)";

/**
 * Buckets persons by surname (case-insensitive, trim), sorted alphabetically
 * by surname (FR collation), with given-name-sorted items inside each bucket.
 * Persons without a surname end up in a trailing "(Sans nom de famille)"
 * bucket so they're not silently dropped.
 */
export function groupBySurname<T extends PersonNamed>(
  persons: T[],
): Array<[string, T[]]> {
  const buckets = new Map<string, T[]>();
  for (const p of persons) {
    const key = (p.surname?.trim() || NO_SURNAME_KEY).toUpperCase();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => {
      if (a === NO_SURNAME_KEY.toUpperCase()) return 1;
      if (b === NO_SURNAME_KEY.toUpperCase()) return -1;
      return a.localeCompare(b, "fr");
    })
    .map<[string, T[]]>(([key, items]) => [
      key,
      [...items].sort((a, b) =>
        (a.givenName ?? "").localeCompare(b.givenName ?? "", "fr"),
      ),
    ]);
}
