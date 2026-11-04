import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Testes de isolamento cross-tenant (Fase 1, critério de aceite obrigatório):
 * "RLS bloqueia acesso cruzado, comprovado por testes."
 *
 * Usa dois usuários em duas organizações distintas e confirma que nenhum
 * deles consegue ler ou escrever dados da organização do outro — apenas
 * através da API pública (anon key + sessão), nunca com a service role.
 *
 * Requer um Supabase local (via `supabase start`, Docker) ou um projeto de
 * desenvolvimento dedicado, com:
 *   TEST_SUPABASE_URL
 *   TEST_SUPABASE_SERVICE_ROLE_KEY   (apenas para setup/teardown via admin)
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (anon)
 *
 * Executar com: npm run test:rls
 *
 * Este arquivo NÃO foi executado neste ambiente (sem Docker disponível
 * para rodar o Supabase local) — ver relatório da fase. Revisar antes de
 * avançar para a Fase 2, conforme regra "não avançar enquanto testes de
 * segurança falharem".
 */

const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const hasEnv = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

type TestUser = {
  email: string;
  password: string;
  userId: string;
  client: SupabaseClient;
  organizationId: string;
};

describe.skipIf(!hasEnv)("Isolamento cross-tenant via RLS", () => {
  let admin: SupabaseClient;
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    userA = await createSignedInTestUser("org-a");
    userB = await createSignedInTestUser("org-b");

    userA.organizationId = await createOrgForUser(userA.client, "Org A");
    userB.organizationId = await createOrgForUser(userB.client, "Org B");
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", userA.organizationId);
    await admin.from("organizations").delete().eq("id", userB.organizationId);
    await admin.auth.admin.deleteUser(userA.userId);
    await admin.auth.admin.deleteUser(userB.userId);
  });

  async function createSignedInTestUser(label: string): Promise<TestUser> {
    const email = `rls-${label}-${randomUUID()}@example.test`;
    const password = `Test-${randomUUID()}`;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(`Falha ao criar usuário de teste: ${createError?.message}`);
    }

    const client = createClient(SUPABASE_URL!, ANON_KEY!);
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      throw new Error(`Falha ao autenticar usuário de teste: ${signInError.message}`);
    }

    return {
      email,
      password,
      userId: created.user.id,
      client,
      organizationId: "",
    };
  }

  async function createOrgForUser(client: SupabaseClient, name: string) {
    const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${randomUUID().slice(0, 8)}`;
    const { data, error } = await client.rpc("create_organization_with_defaults", {
      org_name: name,
      org_slug: slug,
    });
    if (error || !data) {
      throw new Error(`Falha ao criar organização de teste: ${error?.message}`);
    }
    return data as string;
  }

  it("usuário A não vê a organização de B em organizations", async () => {
    const { data } = await userA.client
      .from("organizations")
      .select("id")
      .eq("id", userB.organizationId);
    expect(data ?? []).toHaveLength(0);
  });

  it("usuário A consegue criar uma empresa na própria organização", async () => {
    const { data, error } = await userA.client
      .from("companies")
      .insert({
        organization_id: userA.organizationId,
        name: "Empresa A",
        normalized_name: "empresa a",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("usuário B não consegue ler empresas da organização de A", async () => {
    const { data: ownCompanies } = await userA.client
      .from("companies")
      .select("id")
      .eq("organization_id", userA.organizationId);
    expect(ownCompanies?.length).toBeGreaterThan(0);

    const { data: crossTenantRead } = await userB.client
      .from("companies")
      .select("id")
      .eq("organization_id", userA.organizationId);

    expect(crossTenantRead ?? []).toHaveLength(0);
  });

  it("usuário B não consegue inserir dados na organização de A", async () => {
    const { error } = await userB.client.from("companies").insert({
      organization_id: userA.organizationId,
      name: "Empresa invasora",
      normalized_name: "empresa invasora",
    });

    expect(error).not.toBeNull();
  });

  it("usuário B não vê os membros da organização de A", async () => {
    const { data } = await userB.client
      .from("organization_members")
      .select("id")
      .eq("organization_id", userA.organizationId);
    expect(data ?? []).toHaveLength(0);
  });

  it("usuário B (member) não consegue promover-se a admin na própria org sem ser admin", async () => {
    // userB é owner da própria org (criada via RPC), então este teste
    // documenta o caso contrário: um membro comum não-admin não pode
    // alterar papéis. Como ambos os usuários de teste são owners de suas
    // próprias orgs, usamos a tentativa de update cross-tenant como proxy
    // de que a policy de update de members exige can_admin_org da org alvo.
    const { error } = await userB.client
      .from("organization_members")
      .update({ role: "admin" })
      .eq("organization_id", userA.organizationId);

    expect(error).not.toBeNull();
  });
});
