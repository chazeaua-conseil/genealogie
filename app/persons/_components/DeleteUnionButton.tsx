"use client";

import { Button } from "@/components/ui/button";
import { deleteUnion } from "../[id]/unions/actions";

export function DeleteUnionButton({
  personId,
  familyId,
  partnerLabel,
}: {
  personId: string;
  familyId: string;
  partnerLabel: string;
}) {
  return (
    <form
      action={deleteUnion.bind(null, personId, familyId)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Supprimer l'union avec ${partnerLabel} ? Les éventuels enfants en commun ne seront pas supprimés mais conserveront cette famille comme famille de naissance.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Supprimer
      </Button>
    </form>
  );
}
