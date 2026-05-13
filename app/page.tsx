import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/persons");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-semibold tracking-tight mb-3">
          Généalogie Chazeau
        </h1>
        <p className="text-muted-foreground">
          Application familiale de gestion d&apos;arbres généalogiques.
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/persons" });
        }}
      >
        <Button type="submit">Se connecter avec Google</Button>
      </form>
    </main>
  );
}
