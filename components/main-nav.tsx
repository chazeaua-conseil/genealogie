"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Rechercher", icon: Search, exact: true },
  { href: "/persons", label: "Personnes", icon: Users, exact: false },
  { href: "/tree/members", label: "Membres", icon: UsersRound, exact: false },
];

/**
 * Primary navigation with an active-section pill. Client-side so the current
 * route can be highlighted without threading the pathname through layouts.
 */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-foreground/65 hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
