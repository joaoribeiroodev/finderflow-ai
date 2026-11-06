import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/modules/auth/actions";
import { resolveActiveOrganization } from "@/modules/organizations/active-organization";
import { isCurrentUserSuperAdmin } from "@/modules/organizations/organizations.service";

export const metadata: Metadata = { title: "Conta em análise — FinderFlow AI" };

/**
 * Tela exibida enquanto a organização do usuário aguarda aprovação
 * manual no painel administrativo (Fase 9 — substitui a confirmação de
 * e-mail como controle de acesso). Super admin nunca chega aqui (o
 * layout do workspace já deixa passar antes).
 */
export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
  const { activeOrganization } = await resolveActiveOrganization();

  if (!activeOrganization) {
    redirect("/onboarding");
  }

  if (isSuperAdmin || activeOrganization.approvalStatus === "approved") {
    redirect("/dashboard");
  }

  if (activeOrganization.approvalStatus === "rejected") {
    return (
      <AuthShell
        title="Cadastro não aprovado"
        subtitle="O acesso da sua organização a este sistema foi recusado."
      >
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Se você acredita que isso é um engano, entre em contato com quem administra o
          FinderFlow AI.
        </p>
        <form action={logoutAction} className="mt-6">
          <Button type="submit" variant="secondary" className="w-full">
            Sair
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Conta em análise"
      subtitle="Seu cadastro foi recebido e está aguardando aprovação."
    >
      <p className="text-sm text-[var(--ff-text-secondary)]">
        Um administrador precisa aprovar o acesso da organização{" "}
        <strong className="text-[var(--ff-text-primary)]">
          {activeOrganization.organizationName}
        </strong>{" "}
        antes que você possa usar o FinderFlow AI. Você ganha acesso automaticamente assim que
        for aprovado — não é necessário fazer mais nada além de aguardar.
      </p>
      <form action={logoutAction} className="mt-6">
        <Button type="submit" variant="secondary" className="w-full">
          Sair
        </Button>
      </form>
    </AuthShell>
  );
}
