import Link from "next/link";
import { TreeDeciduous } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name
    .replace(/[._-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export async function SiteHeader() {
  const session = await auth();
  const authed = Boolean(session?.user);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="container mx-auto max-w-6xl flex h-14 items-center justify-between px-6">
        <Link
          href={authed ? "/persons" : "/"}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <TreeDeciduous className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          <span>Généalogie Chazeau</span>
        </Link>

        {authed ? (
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/persons"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors px-2 py-1"
            >
              Mon arbre
            </Link>
            <Link
              href="/tree/members"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors px-2 py-1"
            >
              Membres
            </Link>
            <div className="flex items-center gap-3 pl-4 ml-2 border-l">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] font-medium">
                  {initials(session?.user?.name || session?.user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-xs text-muted-foreground max-w-[160px] truncate">
                {session?.user?.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Déconnexion
                </Button>
              </form>
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
