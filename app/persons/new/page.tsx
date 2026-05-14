import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPerson } from "../actions";

function displayName(p: {
  givenName: string | null;
  surname: string | null;
}) {
  const parts = [p.givenName, p.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "(sans nom)";
}

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ siblingOf?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { siblingOf } = await searchParams;

  // Resolve sibling reference (also checks tree membership) for the UI label.
  const siblingRef = siblingOf
    ? await prisma.person.findFirst({
        where: {
          id: siblingOf,
          tree: { members: { some: { userId: session.user.id } } },
        },
      })
    : null;

  const backHref = siblingRef ? `/persons/${siblingRef.id}/edit` : "/persons";

  return (
    <main className="min-h-screen max-w-xl mx-auto p-8">
      <div className="mb-6">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          {siblingRef
            ? `Nouveau frère/sœur de ${displayName(siblingRef)}`
            : "Nouvelle personne"}
        </h1>
        {siblingRef && (
          <p className="text-sm text-muted-foreground mt-1">
            La nouvelle personne sera ajoutée à la même famille (mêmes parents
            si déjà définis).
          </p>
        )}
      </div>

      <form action={createPerson} className="space-y-5">
        {/* Carry the sibling link through the form so the action can apply it. */}
        {siblingRef && (
          <input type="hidden" name="siblingOf" value={siblingRef.id} />
        )}

        <div className="space-y-2">
          <Label htmlFor="givenName">Prénoms</Label>
          <Input
            id="givenName"
            name="givenName"
            placeholder="Jean Pierre"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="surname">Nom de famille</Label>
          <Input id="surname" name="surname" placeholder="Chazeau" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sex">Sexe</Label>
          <select
            id="sex"
            name="sex"
            defaultValue="UNKNOWN"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="MALE">Masculin</option>
            <option value="FEMALE">Féminin</option>
            <option value="UNKNOWN">Inconnu</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optionnel)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Profession, anecdotes, sources de recherche…"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Au moins un prénom ou un nom est requis. Les détails (naissance,
          décès, parents…) se complètent dans l&apos;édition.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="submit">Enregistrer</Button>
          <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
