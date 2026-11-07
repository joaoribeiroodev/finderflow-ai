import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--ff-radius-pill)] border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-[var(--ff-brass)]/40 bg-[var(--ff-bg-elevated)] text-[var(--ff-brass-soft)]",
        success: "border-[#235c4d] bg-[#13372f] text-[#78e7ba]",
        warning: "border-[#6b531d] bg-[#3c3016] text-[#f9d57b]",
        danger: "border-[#713047] bg-[#421c2a] text-[#ffa2b7]",
        outline: "border-[var(--ff-border-subtle)] bg-transparent text-[var(--ff-text-secondary)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
