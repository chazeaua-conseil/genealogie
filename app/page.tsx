import { auth, signIn, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();

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

      {session?.user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Connecté en tant que{" "}
            <span className="font-medium text-foreground">
              {session.user.name ?? session.user.email}
            </span>
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="outline">
              Se déconnecter
            </Button>
          </form>
        </div>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit">Se connecter avec Google</Button>
        </form>
      )}
    </main>
  );
}
