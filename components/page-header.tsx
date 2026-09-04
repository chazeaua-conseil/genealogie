import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Consistent page masthead: optional back link, title, supporting text and
 * a right-aligned action slot. Used by every full-page screen so headings,
 * spacing and typography stay identical across the app.
 */
export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Retour",
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl text-pretty">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
