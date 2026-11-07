"use client";

import { useActionState, useRef, useEffect } from "react";
import { UserPlus, X } from "lucide-react";

import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  type MemberActionResult,
} from "@/modules/organizations/members.actions";
import { ASSIGNABLE_ROLES } from "@/lib/validation/organizations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface TeamMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  member: "Membro",
  viewer: "Visualizador",
};

const initialState: MemberActionResult = { success: false };

export function TeamMembers({
  members,
  canManage,
  currentUserId,
}: {
  members: TeamMember[];
  canManage: boolean;
  currentUserId: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            canManage={canManage && member.role !== "owner" && member.userId !== currentUserId}
          />
        ))}
      </ul>

      {canManage ? <InviteForm /> : null}
    </div>
  );
}

function MemberRow({ member, canManage }: { member: TeamMember; canManage: boolean }) {
  const [roleState, roleAction, isUpdatingRole] = useActionState(updateMemberRoleAction, initialState);
  const [removeState, removeAction, isRemoving] = useActionState(removeMemberAction, initialState);

  return (
    <li className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[var(--ff-text-primary)]">{member.name}</span>
        {member.status !== "active" ? <Badge variant="warning">{member.status}</Badge> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canManage ? (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="memberId" value={member.id} />
            <label className="sr-only" htmlFor={`role-${member.id}`}>
              Papel de {member.name}
            </label>
            <select
              id={`role-${member.id}`}
              name="role"
              defaultValue={member.role}
              disabled={isUpdatingRole}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-8 rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-2 text-xs text-[var(--ff-text-primary)] disabled:opacity-60"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
        )}

        {canManage ? (
          <form action={removeAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={isRemoving}
              aria-label={`Remover ${member.name}`}
              className="h-8 w-8 px-0 text-[var(--ff-danger)] hover:text-[var(--ff-danger)]"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </form>
        ) : null}
      </div>

      {roleState.message && !roleState.success ? (
        <p role="alert" className="text-xs text-[var(--ff-danger)] sm:basis-full">
          {roleState.message}
        </p>
      ) : null}
      {removeState.message && !removeState.success ? (
        <p role="alert" className="text-xs text-[var(--ff-danger)] sm:basis-full">
          {removeState.message}
        </p>
      ) : null}
    </li>
  );
}

function InviteForm() {
  const [state, formAction, isPending] = useActionState(inviteMemberAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2 border-t border-[var(--ff-border-subtle)] pt-4 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <label className="sr-only" htmlFor="invite-email">
          E-mail da pessoa convidada
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="nome@empresa.com"
          className="h-9 w-full rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)] placeholder:text-[var(--ff-text-muted)]"
        />
        {state.fieldErrors?.email ? (
          <p role="alert" className="mt-1 text-xs text-[var(--ff-danger)]">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <label className="sr-only" htmlFor="invite-role">
        Papel da pessoa convidada
      </label>
      <select
        id="invite-role"
        name="role"
        defaultValue="member"
        className="h-9 rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)]"
      >
        {ASSIGNABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>

      <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 whitespace-nowrap">
        <UserPlus className="size-3.5" aria-hidden />
        {isPending ? "Convidando..." : "Convidar"}
      </Button>

      {state.message ? (
        <p
          role={state.success ? "status" : "alert"}
          className={`text-xs sm:basis-full ${state.success ? "text-[var(--ff-patina-soft)]" : "text-[var(--ff-danger)]"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
