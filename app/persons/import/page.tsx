import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/persons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour à la liste
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">
          Importer un fichier CSV
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Importe en lot une liste de personnes (identité, naissance, décès,
          parents). Les unions / mariages se gèrent ensuite à la main depuis
          chaque fiche.
        </p>
      </div>

      <ImportForm />

      <section className="mt-10 rounded-lg border bg-card p-5 shadow-sm text-sm space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Format attendu
        </h2>
        <p className="text-muted-foreground">
          Fichier CSV UTF-8, séparé par virgules, première ligne = en-têtes.
          Colonnes reconnues (toutes optionnelles sauf <code>person_id</code>
          {" "}et au moins un nom) :
        </p>
        <ul className="text-xs space-y-1 ml-4 list-disc text-muted-foreground">
          <li>
            <code>person_id</code> — identifiant unique de ton choix, sert à
            référencer les parents
          </li>
          <li>
            <code>surname</code>, <code>given_name</code>, <code>nickname</code>
          </li>
          <li>
            <code>sex</code> — <code>M</code>, <code>F</code> ou laisser vide
          </li>
          <li>
            <code>is_living</code> — <code>vivant</code> / <code>oui</code> /
            {" "}<code>true</code> sinon considéré comme décédé
          </li>
          <li>
            <code>birth_date</code>, <code>death_date</code> — formats
            <code> YYYY-MM-DD</code>, <code>DD/MM/YYYY</code>, ou
            <code> YYYY</code> (année seule)
          </li>
          <li>
            <code>birth_place</code>, <code>birth_country</code>,
            <code> death_place</code>, <code>death_country</code>
          </li>
          <li>
            <code>parent_a_id</code>, <code>parent_b_id</code> — référencent
            d&apos;autres <code>person_id</code> du même fichier
          </li>
          <li>
            <code>notes</code>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          ⚠️ L&apos;import <strong>ajoute</strong> les personnes — il ne
          détecte pas les doublons avec celles déjà saisies. Sois vigilant
          quand tu réimportes.
        </p>
      </section>
    </main>
  );
}
