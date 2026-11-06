"use client";

import { useState, useTransition } from "react";
import { KeyRound, Shield, ShieldOff, UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  setUserActiveAction,
  setUserPasswordAction,
  setUserSuperAdminAction,
} from "@/modules/admin/actions";

/**
 * Ações administrativas por usuário no painel /admin: ativar/desativar
 * conta, redefinir senha e conceder/revogar super admin. Componente
 * client porque precisa de feedback imediato (mensagem de
 * sucesso/erro) sem recarregar a página inteira.
 */
export function UserAdminActions({
  userId,
  isActive,
  isSuperAdmin,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");

  function runAction(action: () => Promise<{ success: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message ? { text: result.message, ok: result.success } : null);
      if (result.success) {
        setPasswordOpen(false);
        setPassword("");
      }
    });
  }

  function handleToggleActive() {
    runAction(() => setUserActiveAction(userId, !isActive));
  }

  function handleToggleSuperAdmin() {
    runAction(() => setUserSuperAdminAction(userId, !isSuperAdmin));
  }

  function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setMessage({ text: "A senha precisa ter pelo menos 8 caracteres.", ok: false });
      return;
    }
    runAction(() => setUserPasswordAction(userId, password));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={isActive ? "secondary" : "primary"}
          disabled={isPending || (isActive && isSelf)}
          onClick={handleToggleActive}
          className="gap-1.5"
        >
          {isActive ? <UserX className="size-3.5" aria-hidden /> : <UserCheck className="size-3.5" aria-hidden />}
          {isActive ? "Desativar" : "Reativar"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => setPasswordOpen((v) => !v)}
          className="gap-1.5"
        >
          <KeyRound className="size-3.5" aria-hidden />
          Alterar senha
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || (isSuperAdmin && isSelf)}
          onClick={handleToggleSuperAdmin}
          className="gap-1.5"
        >
          {isSuperAdmin ? <ShieldOff className="size-3.5" aria-hidden /> : <Shield className="size-3.5" aria-hidden />}
          {isSuperAdmin ? "Remover super admin" : "Tornar super admin"}
        </Button>
      </div>

      {passwordOpen ? (
        <form onSubmit={handleSubmitPassword} className="flex flex-wrap items-end gap-2">
          <div className="w-full max-w-[240px]">
            <Field
              label="Nova senha"
              name="newPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Salvar senha
          </Button>
        </form>
      ) : null}

      {message ? (
        <p role="alert" className={`text-xs ${message.ok ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
