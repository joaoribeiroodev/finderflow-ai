import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  errors?: string[];
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, errors, className, id, children, ...props }, ref) => {
    const fieldId = id ?? props.name;
    const hasError = Boolean(errors && errors.length > 0);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-[var(--ff-text-secondary)]">
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={hasError}
          className={cn(
            "h-11 rounded-xl border bg-[var(--ff-bg-surface)] px-3.5 text-[var(--ff-text-primary)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]",
            hasError
              ? "border-[var(--ff-danger)]"
              : "border-[var(--ff-border-subtle)] focus-visible:border-[var(--ff-purple-500)]",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {hasError && (
          <p role="alert" className="text-sm text-[var(--ff-danger)]">
            {errors![0]}
          </p>
        )}
      </div>
    );
  },
);
SelectField.displayName = "SelectField";
