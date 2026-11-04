import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganization } from "@/modules/organizations/active-organization";
import { AuthShell } from "@/components/auth/auth-shell";
import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";

export const metadata: Metadata = { title: "Criar organização — FinderFlow AI" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { memberships } = await resolveActiveOrganization();
  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Crie sua organização"
      subtitle="Cada workspace do FinderFlow AI pertence a uma organização — crie a sua para começar."
    >
      <CreateOrganizationForm />
    </AuthShell>
  );
}
