"use client";

import { Button } from "@/components/ui/button";
import { removeMember } from "./actions";

export function RemoveMemberButton({
  memberId,
  label,
  isSelf,
}: {
  memberId: string;
  label: string;
  isSelf: boolean;
}) {
  return (
    <form
      action={removeMember.bind(null, memberId)}
      onSubmit={(e) => {
        const msg = isSelf
          ? `Quitter cet arbre ? Tu ne pourras plus y accéder tant que quelqu'un ne t'aura pas réinvité.`
          : `Retirer ${label} de l'arbre ? Cette personne perdra l'accès aux données mais les enregistrements eux-mêmes sont conservés.`;
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        {isSelf ? "Quitter" : "Retirer"}
      </Button>
    </form>
  );
}
