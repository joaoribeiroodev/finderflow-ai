"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { deleteOrganizationAction, type DeleteOrganizationResult } from "@/modules/organizations/danger-zone.actions";

const initialState: DeleteOrganizationResult = { success: false };

/**
 * Exclusão da organização (Configurações → Privacidade e segurança). Fica
 * atrás de um "digite o slug para confirmar" — só revelado depois de um
 * clique explícito em "Excluir organização", para não ficar um
 * formulário destrutivo já montado na tela.
 */
export function DangerZone({
  organizationSlug,
  isOwner,
}: {
  organizationSlug: string;
  isOwner: boolean;
}) {
  const [state, formAction, isPending] = useActionState(deleteOrganizationAction, initialState);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  if (!isOwner) return null;

  return (
    <div className="mt-4 rounded-[var(--ff-radius-md)] border border-[var(--ff-danger)]/40 bg-[var(--ff-danger)]/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--ff-danger)]" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[var(--ff-text-primary)]">Excluir organização</p>
          <p className="mt-0.5 text-xs text-[var(--ff-text-muted)]">
            Apaga permanentemente todos os dados desta organização — empresas, leads, propostas,
            contratos, e-mails de prospecção, credenciais. Não pode ser desfeito.
          </p>
        </div>
      </div>

      {!confirmOpen ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3 border-[var(--ff-danger)]/50 text-[var(--ff-danger)] hover:border-[var(--ff-danger)]"
          onClick={() => setConfirmOpen(true)}
        >
          Excluir organização
        </Button>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-[var(--ff-text-secondary)]">
            Digite <b>{organizationSlug}</b> para confirmar:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full max-w-[240px]">
              <Field
                label="Slug de confirmação"
                name="confirmSlug"
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                placeholder={organizationSlug}
                autoComplete="off"
                required
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || confirmSlug !== organizationSlug}
              className="border border-[var(--ff-danger)] bg-[var(--ff-danger)] text-white hover:brightness-110"
            >
              {isPending ? "Excluindo..." : "Confirmar exclusão permanente"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {state.message ? (
        <p role="alert" className="mt-2 text-xs text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
