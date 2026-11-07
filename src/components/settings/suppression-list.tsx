"use client";

import { useActionState } from "react";
import { ShieldOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import {
  addSuppressionEntryAction,
  removeSuppressionEntryAction,
  type SuppressionActionResult,
} from "@/modules/suppression/suppression.actions";
import type { SuppressionEntry } from "@/modules/suppression/suppression.service";

const initialState: SuppressionActionResult = { success: false };

const REASON_LABELS: Record<string, string> = {
  opt_out: "Pedido de descadastro",
  bounce: "E-mail inválido (bounce)",
  complaint: "Reclamação/spam",
  manual: "Adicionado manualmente",
};

/**
 * Lista de supressão / oposição a contato (LGPD — Fase 10). Hoje só
 * alimentada manualmente: quando campanhas/cadências existirem (ver
 * ETAPA-0-AUDITORIA.md seção 9), elas vão consultar `isContactSuppressed`
 * antes de qualquer envio, e bounces/reclamações passam a entrar aqui
 * automaticamente.
 */
export function SuppressionList({
  entries,
  canManage,
}: {
  entries: SuppressionEntry[];
  canManage: boolean;
}) {
  const [state, formAction, isPending] = useActionState(addSuppressionEntryAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 text-sm text-[var(--ff-text-secondary)]">
        <ShieldOff className="mt-0.5 size-4 shrink-0 text-[var(--ff-text-muted)]" aria-hidden />
        Contatos aqui nunca devem ser abordados por nenhum canal de prospecção desta organização —
        é a forma de respeitar um pedido de não ser contatado (LGPD).
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-muted)]">Nenhum contato suprimido ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[var(--ff-text-primary)]">{entry.contactValue}</span>
                  <Badge variant="outline">{entry.contactType === "email" ? "E-mail" : "Telefone"}</Badge>
                </div>
                <span className="text-xs text-[var(--ff-text-muted)]">
                  {REASON_LABELS[entry.reason] ?? entry.reason} ·{" "}
                  {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {canManage ? (
                <form action={removeSuppressionEntryAction}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <Button type="submit" size="sm" variant="ghost" className="gap-1.5">
                    <Trash2 className="size-3.5" aria-hidden />
                    Remover
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-col gap-3 border-t border-[var(--ff-border-subtle)] pt-4 sm:flex-row sm:items-end">
        <div className="sm:w-32">
          <label className="mb-1.5 block text-sm font-medium text-[var(--ff-text-primary)]">Tipo</label>
          <select
            name="contactType"
            defaultValue="email"
            className="h-11 w-full rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)]"
          >
            <option value="email">E-mail</option>
            <option value="phone">Telefone</option>
          </select>
        </div>
        <div className="flex-1">
          <Field label="Contato a suprimir" name="contactValue" placeholder="contato@exemplo.com" autoComplete="off" />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>
      {state.message ? (
        <p role="alert" className={`text-xs ${state.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
