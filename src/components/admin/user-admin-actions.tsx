"use client";

import { useState, useTransition } from "react";
import { KeyRound, Shield, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  deleteUserAction,
  previewDeleteUserAction,
  setUserActiveAction,
  setUserPasswordAction,
  setUserSuperAdminAction,
  type DeleteUserPreview,
} from "@/modules/admin/actions";

/**
 * Ações administrativas por usuário no painel /admin: ativar/desativar
 * conta, redefinir senha e conceder/revogar super admin. Componente
 * client porque precisa de feedback imediato (mensagem de
 * sucesso/erro) sem recarregar a página inteira.
 */
export function UserAdminActions({
  userId,
  email,
  isActive,
  isSuperAdmin,
  isSelf,
}: {
  userId: string;
  email: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeleteUserPreview | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

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

  function handleOpenDelete() {
    setPasswordOpen(false);
    setDeleteOpen(true);
    setMessage(null);
    startTransition(async () => {
      const result = await previewDeleteUserAction(userId);
      if (!result.success || !result.preview) {
        setMessage({ text: result.message ?? "Não foi possível verificar esta conta.", ok: false });
        setDeleteOpen(false);
        return;
      }
      setDeletePreview(result.preview);
    });
  }

  function handleConfirmDelete(e: React.FormEvent) {
    e.preventDefault();
    runAction(async () => {
      const result = await deleteUserAction(userId, deleteConfirmEmail);
      if (result.success) {
        setDeleteOpen(false);
        setDeletePreview(null);
        setDeleteConfirmEmail("");
      }
      return result;
    });
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

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || isSelf}
          onClick={handleOpenDelete}
          className="gap-1.5 border-[var(--ff-danger)]/50 text-[var(--ff-danger)] hover:border-[var(--ff-danger)]"
        >
          <Trash2 className="size-3.5" aria-hidden />
          Excluir usuário
        </Button>
      </div>

      {deleteOpen ? (
        <div className="flex flex-col gap-2 rounded-[var(--ff-radius-md)] border border-[var(--ff-danger)]/40 bg-[var(--ff-danger)]/5 p-3">
          {!deletePreview ? (
            <p className="text-xs text-[var(--ff-text-muted)]">Verificando organizações desta conta…</p>
          ) : deletePreview.blocked ? (
            <>
              <p className="text-sm font-medium text-[var(--ff-danger)]">Não é possível excluir esta conta.</p>
              <p className="text-xs text-[var(--ff-text-secondary)]">
                Ela é a única proprietária de organizações com outros membros:{" "}
                {deletePreview.blockedOrganizations.map((o) => o.name).join(", ")}. Transfira a titularidade ou
                exclua essas organizações primeiro (em Configurações → Privacidade e segurança, como o próprio
                dono).
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setDeleteOpen(false)}>
                Entendi
              </Button>
            </>
          ) : (
            <form onSubmit={handleConfirmDelete} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[var(--ff-danger)]">
                Excluir esta conta é irreversível.
              </p>
              {deletePreview.organizationsToDelete.length > 0 ? (
                <p className="text-xs text-[var(--ff-text-secondary)]">
                  As organizações onde esta é a única pessoa também serão apagadas junto, com todos os dados:{" "}
                  {deletePreview.organizationsToDelete.map((o) => o.name).join(", ")}.
                </p>
              ) : null}
              <div className="w-full max-w-[280px]">
                <Field
                  label={`Digite "${email ?? "o e-mail da conta"}" para confirmar`}
                  name="confirmEmail"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder={email ?? ""}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !email || deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase()}
                  className="border border-[var(--ff-danger)] bg-[var(--ff-danger)] text-white hover:brightness-110"
                >
                  Excluir permanentemente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeletePreview(null);
                    setDeleteConfirmEmail("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

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
