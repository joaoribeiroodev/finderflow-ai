"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  recoveryRequestSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { getServerEnv } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";
import { checkLoginLockout, recordLoginAttempt } from "@/lib/auth/login-security";

export interface ActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email;

  const lockout = await checkLoginLockout(email);
  if (lockout.locked) {
    return {
      success: false,
      message: `Muitas tentativas de login sem sucesso. Tente novamente em ${lockout.retryAfterMinutes} minuto(s).`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  await recordLoginAttempt(email, !error);

  if (error) {
    logger.warn("Falha no login", { reason: error.message });
    return {
      success: false,
      message: "E-mail ou senha incorretos.",
    };
  }

  redirect("/dashboard");
}

export async function registerAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const env = getServerEnv();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/onboarding`,
    },
  });

  if (error) {
    logger.warn("Falha no cadastro", { reason: error.message });
    if (error.code === "user_already_exists") {
      return { success: false, message: "Já existe uma conta com esse e-mail." };
    }
    return { success: false, message: "Não foi possível criar sua conta." };
  }

  // Fase 9: a confirmação de e-mail do Supabase Auth deixou de ser o
  // controle de acesso — quem decide é a aprovação manual no painel
  // administrativo (ver docs/DECISIONS.md). Se o projeto já estiver com
  // "Confirm email" desativado, `signUp` devolve sessão ativa na hora;
  // seguimos direto para o onboarding (criar a organização), que nasce
  // pendente de aprovação. Se ainda não foi desativado (lag entre
  // ambientes), caímos de volta no fluxo antigo de confirmação por e-mail.
  if (data.session) {
    redirect("/onboarding");
  }

  return {
    success: true,
    message: "Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar.",
  };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordRecoveryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = recoveryRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const env = getServerEnv();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/recovery/reset`,
  });

  if (error) {
    logger.warn("Falha ao solicitar recuperação de senha", {
      reason: error.message,
    });
    // Não revelar se o e-mail existe ou não.
  }

  return {
    success: true,
    message: "Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
  };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    logger.warn("Falha ao redefinir senha", { reason: error.message });
    return {
      success: false,
      message: "Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.",
    };
  }

  redirect("/dashboard");
}
