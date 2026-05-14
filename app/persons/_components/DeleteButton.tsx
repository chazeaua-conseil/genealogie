"use client";

import { Button } from "@/components/ui/button";
import { deletePerson } from "../[id]/actions";

export function DeleteButton({ id, label }: { id: string; label: string }) {
  return (
    <form
      action={deletePerson.bind(null, id)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Supprimer "${label}" ? Cette action est définitive et entraîne aussi la suppression des événements et relations rattachés.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="destructive" size="sm">
        Supprimer
      </Button>
    </form>
  );
}
