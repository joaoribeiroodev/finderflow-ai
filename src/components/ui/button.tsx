import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-[var(--ff-purple-600)] to-[var(--ff-magenta)] text-white hover:brightness-110",
        secondary:
          "bg-[var(--ff-bg-elevated)] text-[var(--ff-text-primary)] border border-[var(--ff-border-subtle)] hover:border-[var(--ff-purple-500)]",
        ghost: "text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
