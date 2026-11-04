import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Criar conta — FinderFlow AI" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Criar conta"
      subtitle="Comece a prospectar empresas com inteligência de IA."
      footer={
        <span className="text-[var(--ff-text-secondary)]">
          Já tem conta?{" "}
          <Link href="/login" className="text-[var(--ff-violet-glow)] hover:underline">
            Entrar
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
