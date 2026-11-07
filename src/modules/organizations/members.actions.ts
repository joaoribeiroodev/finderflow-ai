"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";
import { assertCanAdminOrganization } from "@/lib/permissions/permissions";
import { inviteMemberSchema, updateMemberRoleSchema } from "@/lib/validation/organizations";

import { requireActiveOrganization } from "./active-organization";

export interface MemberActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Convida um novo membro por e-mail (Configurações → Equipe e permissões).
 *
 * Usa `supabase.auth.admin.inviteUserByEmail` (cliente com Service Role —
 * só pode ser chamado aqui, no servidor, depois de revalidar admin/owner
 * via `assertCanAdminOrganization`): isso cria o usuário no Supabase Auth
 * imediatamente e dispara o e-mail de convite; o link devolve a pessoa
 * para `/auth/confirm?next=/recovery/reset`, que já sabe verificar um
 * token `type=invite` (`src/app/auth/confirm/route.ts`) e a leva direto
 * para definir a própria senha (`/recovery/reset`, reaproveitando o mesmo
 * fluxo da recuperação de senha).
 *
 * A vinculação à organização (`organization_members`) é gravada como
 * `status: 'active'` já neste passo: a pessoa convidada não consegue se
 * autenticar enquanto não completar o link de convite, então não há
 * janela de acesso indevido em deixar o vínculo ativo desde já — e assim
 * ela aparece de imediato na lista de membros, com o papel correto.
 */
export async function inviteMemberAction(
  _prev: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanAdminOrganization(supabase, organizationId);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Sem permissão para convidar membros.",
    };
  }

  const env = getServerEnv();
  const admin = createAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/recovery/reset` },
  );

  if (inviteError || !invited?.user) {
    const alreadyRegistered = inviteError?.message?.toLowerCase().includes("already been registered");
    logger.warn("Falha ao convidar membro", {
      reason: inviteError?.message,
      organizationId,
    });
    return {
      success: false,
      message: alreadyRegistered
        ? "Este e-mail já tem uma conta no FinderFlow AI. Peça para a pessoa entrar normalmente — se ela ainda não estiver nesta organização, adicione-a pelo suporte."
        : "Não foi possível enviar o convite. Confira o e-mail e tente novamente.",
    };
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: organizationId,
    user_id: invited.user.id,
    role: parsed.data.role,
    status: "active",
  });

  if (memberError) {
    const alreadyMember = memberError.code === "23505"; // unique_violation (organization_id, user_id)
    logger.error("Convite enviado, mas falhou ao vincular membro à organização", {
      error: memberError.message,
      organizationId,
      userId: invited.user.id,
    });
    return {
      success: false,
      message: alreadyMember
        ? "Esta pessoa já é membro desta organização."
        : "O convite foi enviado, mas houve um erro ao vincular o membro à organização.",
    };
  }

  revalidatePath("/settings");
  return { success: true, message: `Convite enviado para ${parsed.data.email}.` };
}

/** Troca o papel de um membro existente (Configurações → Equipe e permissões). */
export async function updateMemberRoleAction(
  _prev: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  const parsed = updateMemberRoleSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { success: false, message: "Papel inválido." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanAdminOrganization(supabase, organizationId);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Sem permissão para alterar papéis.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: target } = await supabase
    .from("organization_members")
    .select("id, role, user_id")
    .eq("id", parsed.data.memberId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!target) {
    return { success: false, message: "Membro não encontrado." };
  }
  if (target.role === "owner") {
    return { success: false, message: "O papel do proprietário não pode ser alterado por aqui." };
  }
  if (target.user_id === user?.id) {
    return { success: false, message: "Você não pode alterar o próprio papel." };
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("organization_id", organizationId);

  if (error) {
    logger.error("Falha ao alterar papel de membro", { error: error.message, organizationId });
    return { success: false, message: "Não foi possível alterar o papel deste membro." };
  }

  revalidatePath("/settings");
  return { success: true, message: "Papel atualizado." };
}

/** Remove um membro da organização (Configurações → Equipe e permissões). */
export async function removeMemberAction(
  _prev: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) {
    return { success: false, message: "Membro inválido." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanAdminOrganization(supabase, organizationId);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Sem permissão para remover membros.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: target } = await supabase
    .from("organization_members")
    .select("id, role, user_id")
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!target) {
    return { success: false, message: "Membro não encontrado." };
  }
  if (target.role === "owner") {
    return { success: false, message: "O proprietário da organização não pode ser removido." };
  }
  if (target.user_id === user?.id) {
    return { success: false, message: "Você não pode remover a si mesmo. Saia pelo menu de usuário." };
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organizationId);

  if (error) {
    logger.error("Falha ao remover membro", { error: error.message, organizationId });
    return { success: false, message: "Não foi possível remover este membro." };
  }

  revalidatePath("/settings");
  return { success: true, message: "Membro removido." };
}
