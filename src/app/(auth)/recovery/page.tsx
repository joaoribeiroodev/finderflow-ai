import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryForm } from "@/components/auth/recovery-form";

export const metadata: Metadata = { title: "Recuperar senha — FinderFlow AI" };

export default function RecoveryPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha."
      footer={
        <Link href="/login" className="text-[var(--ff-violet-glow)] hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <RecoveryForm />
    </AuthShell>
  );
}
