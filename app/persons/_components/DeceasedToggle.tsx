"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Wraps the "Décès" section so it can be hidden visually when the user
 * marks the person as living. The wrapper keeps the inputs in the DOM
 * (only toggles `hidden`) so accidental clicks on the checkbox don't
 * wipe a value the user just typed.
 *
 * Form values for death.* are still submitted while hidden; the Server
 * Action ignores them when `isLiving` is true.
 */
export function DeceasedToggle({
  defaultIsLiving,
  children,
}: {
  defaultIsLiving: boolean;
  children: ReactNode;
}) {
  const [isLiving, setIsLiving] = useState(defaultIsLiving);

  useEffect(() => {
    function onChange(e: Event) {
      const target = e.target as HTMLInputElement | null;
      if (!target) return;
      if (target.name === "isLiving" && target.type === "checkbox") {
        setIsLiving(target.checked);
      }
    }
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  return <div hidden={isLiving}>{children}</div>;
}
