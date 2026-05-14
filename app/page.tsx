import { redirect } from "next/navigation";
import { TreeDeciduous, ShieldCheck, Map, Users } from "lucide-react";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/persons");

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <section className="text-center max-w-2xl">
        <div className="inline-flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 p-4 mb-6">
          <TreeDeciduous className="h-10 w-10 text-emerald-700 dark:text-emerald-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
          Généalogie Chazeau
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-10">
          Outil familial pour structurer et visualiser nos arbres
          généalogiques.{" "}
          <span className="text-foreground/80">Accès privé.</span>
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/persons" });
          }}
        >
          <Button type="submit" size="lg">
            Se connecter avec Google
          </Button>
        </form>
      </section>

      <section className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
        <Feature
          icon={Users}
          title="Personnes & familles"
          description="Saisis identités, dates et lieux pour chaque ancêtre, en français et avec précision."
        />
        <Feature
          icon={Map}
          title="Lieux normalisés"
          description="Autocomplétion mondiale via OpenStreetMap, pays par pays."
        />
        <Feature
          icon={ShieldCheck}
          title="Sauvegardes quotidiennes"
          description="Une copie horodatée du contenu chaque nuit, conservée 30 jours."
        />
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-left">
      <Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-400 mb-3" />
      <h2 className="font-medium text-sm mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
