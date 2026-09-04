import Link from "next/link";
import { TreeDeciduous } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-6xl flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight shrink-0"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-subtle text-accent-foreground">
            <TreeDeciduous className="h-4.5 w-4.5" />
          </span>
          <span className="hidden sm:inline">Généalogie Chazeau</span>
        </Link>

        {authed ? (
          <div className="flex items-center gap-1.5 sm:gap-3">
            <MainNav />
            <div className="flex items-center gap-1.5 border-l border-border/70 pl-2 sm:pl-3">
              <ThemeToggle />
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] font-medium">
                  {initials(session?.user?.name || session?.user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:inline text-xs text-muted-foreground max-w-[150px] truncate">
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
          </div>
        ) : (
          <ThemeToggle />
        )}
      </div>
    </header>
  );
}
