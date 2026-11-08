"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  enrollLeadInCadenceAction,
  markCadenceEnrollmentRespondedAction,
  pauseCadenceEnrollmentAction,
  resumeCadenceEnrollmentAction,
  type CadenceEnrollmentActionResult,
} from "@/modules/cadences/cadence-enrollments.actions";
import type { CadenceEnrollmentRow } from "@/modules/cadences/cadence-enrollments.service";
import type { CadenceListEntry } from "@/modules/cadences/cadences.service";
import { formatRelativeDateTime } from "@/lib/utils/format";

const initialState: CadenceEnrollmentActionResult = { success: false };

const statusVariant = {
  active: "success",
  paused: "warning",
  stopped: "outline",
  completed: "default",
} as const;

const statusLabel = {
  active: "Ativa",
  paused: "Pausada",
  stopped: "Parada",
  completed: "Concluída",
} as const;

function EnrollForm({ leadId, availableCadences }: { leadId: string; availableCadences: CadenceListEntry[] }) {
  const [state, formAction, isPending] = useActionState(enrollLeadInCadenceAction, initialState);

  if (availableCadences.length === 0) {
    return (
      <p className="text-sm text-[var(--ff-text-secondary)]">
        Nenhuma cadência ativa disponível. Crie uma em Cadências no menu.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex-1">
        <label htmlFor="cadenceId" className="mb-1.5 block text-sm font-medium text-[var(--ff-text-secondary)]">
          Inscrever em uma cadência
        </label>
        <select
          id="cadenceId"
          name="cadenceId"
          className="h-11 w-full rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)]"
        >
          {availableCadences.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.stepCount} etapa{c.stepCount === 1 ? "" : "s"})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Inscrevendo..." : "Inscrever"}
      </Button>
      {state.message ? (
        <p role="alert" className={`text-xs ${state.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function EnrollmentActions({ leadId, enrollment }: { leadId: string; enrollment: CadenceEnrollmentRow }) {
  const [pauseState, pauseAction, pausePending] = useActionState(pauseCadenceEnrollmentAction, initialState);
  const [resumeState, resumeAction, resumePending] = useActionState(resumeCadenceEnrollmentAction, initialState);
  const [respondedState, respondedAction, respondedPending] = useActionState(
    markCadenceEnrollmentRespondedAction,
    initialState,
  );

  if (enrollment.status === "stopped" || enrollment.status === "completed") return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {enrollment.status === "active" ? (
        <form action={pauseAction}>
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="enrollmentId" value={enrollment.id} />
          <Button type="submit" size="sm" variant="secondary" disabled={pausePending}>
            Pausar
          </Button>
        </form>
      ) : (
        <form action={resumeAction}>
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="enrollmentId" value={enrollment.id} />
          <Button type="submit" size="sm" variant="secondary" disabled={resumePending}>
            Retomar
          </Button>
        </form>
      )}
      <form action={respondedAction}>
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="enrollmentId" value={enrollment.id} />
        <Button type="submit" size="sm" variant="ghost" disabled={respondedPending}>
          Marcar como respondeu
        </Button>
      </form>
      {(pauseState.message || resumeState.message || respondedState.message) ? (
        <p role="alert" className="text-xs text-[var(--ff-danger)]">
          {pauseState.message || resumeState.message || respondedState.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Módulo 7 — card de cadências na página do lead. Inscrição manual
 * (sempre um humano decidindo entrar numa cadência, nunca automático);
 * a partir daí, os envios de cada etapa são automáticos (template já
 * aprovado ao ser escrito — ver cadence-compose.ts) até o lead
 * fechar, ser suprimido, ou alguém marcar "respondeu" manualmente.
 */
export function CadenceEnrollmentCard({
  leadId,
  availableCadences,
  enrollments,
}: {
  leadId: string;
  availableCadences: CadenceListEntry[];
  enrollments: CadenceEnrollmentRow[];
}) {
  const enrolledCadenceIds = new Set(
    enrollments.filter((e) => e.status === "active" || e.status === "paused").map((e) => e.cadenceId),
  );
  const selectableCadences = availableCadences.filter((c) => !enrolledCadenceIds.has(c.id));

  return (
    <Card>
      <CardHeader title="Cadências de follow-up" subtitle="Sequências automáticas de e-mail até o lead responder ou fechar." />

      <div className="flex flex-col gap-4">
        <EnrollForm leadId={leadId} availableCadences={selectableCadences} />

        {enrollments.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {enrollments.map((enrollment) => (
              <li key={enrollment.id} className="rounded-xl border border-[var(--ff-border-subtle)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--ff-text-primary)]">{enrollment.cadenceName}</span>
                  <Badge variant={statusVariant[enrollment.status]}>{statusLabel[enrollment.status]}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--ff-text-muted)]">
                  Etapa {enrollment.currentStepOrder} ·{" "}
                  {enrollment.status === "active" || enrollment.status === "paused"
                    ? `próximo envio ${formatRelativeDateTime(enrollment.nextRunAt)}`
                    : enrollment.stoppedReason
                      ? `parada: ${enrollment.stoppedReason}`
                      : null}
                </p>
                <EnrollmentActions leadId={leadId} enrollment={enrollment} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
