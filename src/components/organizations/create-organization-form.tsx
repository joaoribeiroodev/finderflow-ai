"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  createOrganizationAction,
  type OrganizationActionResult,
} from "@/modules/organizations/actions";
import { slugify } from "@/lib/validation/organizations";

const initialState: OrganizationActionResult = { success: false };

export function CreateOrganizationForm() {
  const [state, formAction, isPending] = useActionState(createOrganizationAction, initialState);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Nome da organização"
        name="name"
        required
        errors={state.fieldErrors?.name}
        onChange={(e) => {
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />
      <Field
        label="Identificador (slug)"
        name="slug"
        required
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value);
        }}
        errors={state.fieldErrors?.slug}
        placeholder="minha-agencia"
      />
      {state.message && (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar organização"}
      </Button>
    </form>
  );
}
