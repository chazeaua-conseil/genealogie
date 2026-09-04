import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { BulkPersonsGrid } from "./BulkPersonsGrid";

export default async function BulkPersonsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <PageHeader
        backHref="/persons"
        backLabel="Retour à la liste"
        eyebrow="Saisie rapide"
        title="Ajouter plusieurs personnes"
        description="Une ligne par personne : identité, naissance et décès. Les liens de parenté (parents, unions) se posent ensuite depuis chaque fiche."
      />
      <BulkPersonsGrid />
    </main>
  );
}
