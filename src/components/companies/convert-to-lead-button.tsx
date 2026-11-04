"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { convertToLeadAction, type SimpleActionResult } from "@/modules/companies/actions";

const initialState: SimpleActionResult = { success: false };

export function ConvertToLeadButton({ companyId }: { companyId: string }) {
  const [state, formAction, isPending] = useActionState(convertToLeadAction, initialState);

  if (state.success) {
    return <p className="text-sm text-[var(--ff-success)]">{state.message}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Convertendo..." : "Converter em lead"}
      </Button>
      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
