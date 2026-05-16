"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getOrCreateDefaultTree } from "@/lib/tree";
import {
  commitImport,
  previewCsv,
  type ImportPreview,
  type ImportResult,
} from "@/lib/csv-import";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  return session;
}

export async function previewImportAction(
  content: string,
): Promise<ImportPreview> {
  await requireSession();
  return previewCsv(content);
}

export async function commitImportAction(
  content: string,
): Promise<
  | { success: true; result: ImportResult }
  | { success: false; error: string }
> {
  try {
    const session = await requireSession();
    const tree = await getOrCreateDefaultTree(session.user!.id!);

    const preview = previewCsv(content);
    if (preview.errors.length > 0) {
      return {
        success: false,
        error: `Le fichier contient ${preview.errors.length} erreur(s). Corrige-les et réessaie.`,
      };
    }
    if (preview.rows.length === 0) {
      return { success: false, error: "Aucune ligne à importer." };
    }

    const result = await commitImport(preview.rows, tree.id, session.user!.id!);
    revalidatePath("/persons");
    return { success: true, result };
  } catch (err) {
    console.error("[commitImportAction] failed:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Une erreur inconnue est survenue pendant l'import.",
    };
  }
}
