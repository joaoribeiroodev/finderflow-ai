import { describe, expect, it } from "vitest";

import { inviteMemberSchema, updateMemberRoleSchema, ASSIGNABLE_ROLES } from "./organizations";

describe("inviteMemberSchema", () => {
  it("aceita e-mail válido e papel atribuível", () => {
    const result = inviteMemberSchema.safeParse({ email: "Nova@Empresa.com", role: "manager" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("nova@empresa.com"); // normalizado em minúsculas
  });

  it("rejeita e-mail inválido", () => {
    const result = inviteMemberSchema.safeParse({ email: "não-é-email", role: "member" });
    expect(result.success).toBe(false);
  });

  it("rejeita o papel 'owner' — não é atribuível por convite", () => {
    const result = inviteMemberSchema.safeParse({ email: "nova@empresa.com", role: "owner" });
    expect(result.success).toBe(false);
  });

  it("todo papel em ASSIGNABLE_ROLES passa a validação", () => {
    for (const role of ASSIGNABLE_ROLES) {
      const result = inviteMemberSchema.safeParse({ email: "nova@empresa.com", role });
      expect(result.success).toBe(true);
    }
  });
});

describe("updateMemberRoleSchema", () => {
  it("exige memberId em formato UUID", () => {
    const result = updateMemberRoleSchema.safeParse({ memberId: "not-a-uuid", role: "admin" });
    expect(result.success).toBe(false);
  });

  it("rejeita o papel 'owner'", () => {
    const result = updateMemberRoleSchema.safeParse({
      memberId: "123e4567-e89b-12d3-a456-426614174000",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("aceita memberId válido com papel atribuível", () => {
    const result = updateMemberRoleSchema.safeParse({
      memberId: "123e4567-e89b-12d3-a456-426614174000",
      role: "viewer",
    });
    expect(result.success).toBe(true);
  });
});
