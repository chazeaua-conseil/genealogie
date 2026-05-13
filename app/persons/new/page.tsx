import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPerson } from "../actions";

export default async function NewPersonPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <main className="min-h-screen max-w-xl mx-auto p-8">
      <div className="mb-6">
        <Link
          href="/persons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          Nouvelle personne
        </h1>
      </div>

      <form action={createPerson} className="space-y-5">
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
          Au moins un prénom ou un nom est requis.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="submit">Enregistrer</Button>
          <Link
            href="/persons"
            className={buttonVariants({ variant: "ghost" })}
          >
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
