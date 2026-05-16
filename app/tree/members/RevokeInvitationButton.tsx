"use client";

import { Button } from "@/components/ui/button";
import { revokeInvitation } from "./actions";

export function RevokeInvitationButton({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  return (
    <form
      action={revokeInvitation.bind(null, invitationId)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Annuler l'invitation envoyée à ${email} ? La personne ne pourra plus rejoindre l'arbre avec ce lien.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Annuler
      </Button>
    </form>
  );
}
