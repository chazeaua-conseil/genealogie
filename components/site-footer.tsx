import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-background mt-16">
      <div className="container mx-auto max-w-6xl px-6 py-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>© {year} Généalogie Chazeau · Application familiale</div>
        <div className="flex flex-wrap items-center gap-3">
          <span>Données géographiques © OpenStreetMap contributors</span>
          <Link
            href="https://github.com/chazeaua-conseil/genealogie"
            className="hover:text-foreground transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Code source
          </Link>
        </div>
      </div>
    </footer>
  );
}
