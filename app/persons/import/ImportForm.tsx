"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  commitImportAction,
  previewImportAction,
} from "./actions";
import type { ImportPreview } from "@/lib/csv-import";

type Phase =
  | { kind: "idle" }
  | { kind: "previewing" }
  | { kind: "preview-ready"; preview: ImportPreview; fileName: string; content: string }
  | { kind: "committing"; content: string; fileName: string; preview: ImportPreview }
  | { kind: "done"; importedPersons: number; appliedParentLinks: number }
  | { kind: "error"; message: string };

export function ImportForm() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFileChosen(file: File) {
    setPhase({ kind: "previewing" });
    try {
      const content = await file.text();
      const preview = await previewImportAction(content);
      setPhase({
        kind: "preview-ready",
        preview,
        fileName: file.name,
        content,
      });
    } catch (err) {
      setPhase({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Erreur lors de la lecture du fichier.",
      });
    }
  }

  async function onConfirmImport() {
    if (phase.kind !== "preview-ready") return;
    setPhase({
      kind: "committing",
      content: phase.content,
      fileName: phase.fileName,
      preview: phase.preview,
    });
    startTransition(async () => {
      const res = await commitImportAction(phase.content);
      if (res.success) {
        setPhase({
          kind: "done",
          importedPersons: res.result.importedPersons,
          appliedParentLinks: res.result.appliedParentLinks,
        });
      } else {
        setPhase({ kind: "error", message: res.error });
      }
    });
  }

  function reset() {
    setPhase({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (phase.kind === "done") {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h2 className="font-semibold text-lg">Import réussi</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {phase.importedPersons} personne
              {phase.importedPersons > 1 ? "s" : ""} créée
              {phase.importedPersons > 1 ? "s" : ""},{" "}
              {phase.appliedParentLinks} lien
              {phase.appliedParentLinks > 1 ? "s" : ""} parent-enfant appliqué
              {phase.appliedParentLinks > 1 ? "s" : ""}.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/persons"
                className={buttonVariants({ size: "sm" })}
              >
                Voir l&apos;arbre
              </Link>
              <Button variant="outline" size="sm" onClick={reset}>
                Importer un autre fichier
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Fichier
        </h2>

        <label
          htmlFor="csv-file"
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-background/50 py-10 px-6 cursor-pointer hover:bg-muted/30 transition-colors",
            phase.kind === "previewing" && "opacity-60 pointer-events-none",
          )}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
          <span className="text-sm font-medium">
            {phase.kind === "preview-ready"
              ? phase.fileName
              : "Choisir un fichier CSV"}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            UTF-8, séparé par virgules — voir le modèle
          </span>
          <input
            ref={fileInputRef}
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileChosen(file);
            }}
          />
        </label>

        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <a
            href="/template-import.csv"
            download
            className="hover:text-foreground underline"
          >
            Télécharger un modèle d&apos;exemple
          </a>
        </div>
      </div>

      {phase.kind === "preview-ready" && (
        <PreviewPanel
          preview={phase.preview}
          fileName={phase.fileName}
          onConfirm={onConfirmImport}
          onCancel={reset}
        />
      )}

      {phase.kind === "committing" && (
        <div className="rounded-lg border bg-card p-5 shadow-sm text-sm text-muted-foreground">
          Import en cours… ({phase.preview.rows.length} personne
          {phase.preview.rows.length > 1 ? "s" : ""})
        </div>
      )}

      {phase.kind === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-destructive mb-1">
                Erreur d&apos;import
              </h3>
              <p className="text-sm text-foreground/80">{phase.message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="mt-3"
              >
                Recommencer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPanel({
  preview,
  fileName,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const hasBlockingErrors = preview.errors.length > 0;
  const sampleRows = preview.rows.slice(0, 10);

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Aperçu de l&apos;import
        </h2>
        <span className="text-xs text-muted-foreground">{fileName}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Lignes détectées" value={preview.rows.length.toString()} />
        <Stat
          label="Erreurs"
          value={preview.errors.length.toString()}
          tone={preview.errors.length > 0 ? "danger" : "muted"}
        />
        <Stat
          label="Avertissements"
          value={preview.warnings.length.toString()}
          tone={preview.warnings.length > 0 ? "warning" : "muted"}
        />
      </div>

      {preview.errors.length > 0 && (
        <IssueList
          title="Erreurs (bloquantes)"
          items={preview.errors}
          variant="error"
        />
      )}

      {preview.warnings.length > 0 && (
        <IssueList
          title="Avertissements"
          items={preview.warnings}
          variant="warning"
        />
      )}

      {sampleRows.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            Échantillon (premières lignes)
          </h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">person_id</th>
                  <th className="px-3 py-2 font-medium">surname</th>
                  <th className="px-3 py-2 font-medium">given_name</th>
                  <th className="px-3 py-2 font-medium">sex</th>
                  <th className="px-3 py-2 font-medium">birth</th>
                  <th className="px-3 py-2 font-medium">death</th>
                  <th className="px-3 py-2 font-medium">parents</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sampleRows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono">{r.person_id ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.surname ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.given_name ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.sex ?? "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {[r.birth_date, r.birth_place].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {[r.death_date, r.death_place].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">
                      {[r.parent_a_id, r.parent_b_id].filter(Boolean).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 10 && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {preview.rows.length - 10} autres lignes non affichées dans
              l&apos;aperçu.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          onClick={onConfirm}
          disabled={hasBlockingErrors || preview.rows.length === 0}
        >
          {hasBlockingErrors
            ? "Corrige les erreurs avant d'importer"
            : `Importer ${preview.rows.length} personne${preview.rows.length > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-foreground",
    muted: "text-muted-foreground",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
  }[tone];
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-lg font-semibold", toneClass)}>{value}</div>
    </div>
  );
}

function IssueList({
  title,
  items,
  variant,
}: {
  title: string;
  items: { row: number; message: string }[];
  variant: "error" | "warning";
}) {
  const visible = items.slice(0, 15);
  const remaining = items.length - visible.length;
  const wrapperClass =
    variant === "error"
      ? "border-destructive/30 bg-destructive/5"
      : "border-amber-500/30 bg-amber-50 dark:bg-amber-950/20";
  const titleClass =
    variant === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400";

  return (
    <div className={cn("rounded-md border p-3", wrapperClass)}>
      <h4 className={cn("text-sm font-medium mb-2", titleClass)}>
        {title} ({items.length})
      </h4>
      <ul className="space-y-1 text-xs">
        {visible.map((it, i) => (
          <li key={i}>
            <span className="font-mono text-muted-foreground">
              {it.row > 0 ? `Ligne ${it.row}` : "Fichier"}
            </span>
            <span className="mx-1">·</span>
            {it.message}
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2">
          + {remaining} autre{remaining > 1 ? "s" : ""}
          {variant === "error" ? " erreur" : " avertissement"}
          {remaining > 1 ? "s" : ""} non affichée
          {remaining > 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
}

// Silence unused-import warning for router in case future iterations
// wire navigation directly from a hook here.
void useRouter;
