import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar — FinderFlow AI" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse sua conta para continuar prospectando."
      footer={
        <span className="text-[var(--ff-text-secondary)]">
          Não tem conta?{" "}
          <Link href="/register" className="text-[var(--ff-violet-glow)] hover:underline">
            Cadastre-se
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
