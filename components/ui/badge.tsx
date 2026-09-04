import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground ring-foreground/10",
        brand: "bg-brand-subtle text-accent-foreground ring-brand/20",
        male: "bg-male/10 text-male ring-male/20",
        female: "bg-female/10 text-female ring-female/20",
        warning:
          "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-300",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
