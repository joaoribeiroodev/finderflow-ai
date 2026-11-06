import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/modules/organizations/organizations.service";

/**
 * Painel administrativo (Fase 9) — fora do shell do workspace de
 * propósito: um super admin precisa conseguir aprovar organizações
 * mesmo que a própria organização dele esteja pendente.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
  if (!isSuperAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--ff-bg-canvas)] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
