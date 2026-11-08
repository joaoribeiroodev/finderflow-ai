import { describe, expect, it } from "vitest";

import { COPILOT_TOOLS, copilotToolsAsConversationTools, getCopilotTool } from "./copilot-tools";

describe("COPILOT_TOOLS (allowlist)", () => {
  it("não tem nomes duplicados", () => {
    const names = COPILOT_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("marca create_task, update_lead_stage e enroll_lead_in_cadence como mutating (exigem confirmação)", () => {
    expect(getCopilotTool("create_task")?.mutating).toBe(true);
    expect(getCopilotTool("update_lead_stage")?.mutating).toBe(true);
    expect(getCopilotTool("enroll_lead_in_cadence")?.mutating).toBe(true);
  });

  it("marca as ferramentas de leitura como não-mutating", () => {
    for (const name of [
      "list_leads",
      "get_lead_details",
      "get_tasks_due",
      "get_pipeline_metrics",
      "get_sales_report",
      "get_digital_presence_score",
      "get_website_audit",
      "list_active_cadences",
    ]) {
      expect(getCopilotTool(name)?.mutating).toBe(false);
    }
  });

  it("toda ferramenta mutating tem describeForConfirmation definido", () => {
    for (const tool of COPILOT_TOOLS) {
      if (tool.mutating) expect(tool.describeForConfirmation).toBeTypeOf("function");
    }
  });

  it("getCopilotTool retorna undefined para um nome fora da allowlist (nunca executa algo arbitrário)", () => {
    expect(getCopilotTool("delete_everything")).toBeUndefined();
    expect(getCopilotTool("run_sql")).toBeUndefined();
  });

  it("copilotToolsAsConversationTools expõe name/description/parameters de cada ferramenta", () => {
    const defs = copilotToolsAsConversationTools();
    expect(defs).toHaveLength(COPILOT_TOOLS.length);
    for (const def of defs) {
      expect(def.name).toBeTypeOf("string");
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});

describe("validação dos argumentos de cada ferramenta", () => {
  it("create_task rejeita leadId que não é UUID", () => {
    const tool = getCopilotTool("create_task")!;
    const result = tool.parameters.safeParse({ leadId: "não-é-uuid", title: "Ligar para o cliente" });
    expect(result.success).toBe(false);
  });

  it("create_task aceita título e leadId válidos, sem campos opcionais", () => {
    const tool = getCopilotTool("create_task")!;
    const result = tool.parameters.safeParse({
      leadId: "11111111-1111-4111-8111-111111111111",
      title: "Ligar para o cliente",
    });
    expect(result.success).toBe(true);
  });

  it("update_lead_stage exige leadId e stageId válidos", () => {
    const tool = getCopilotTool("update_lead_stage")!;
    expect(tool.parameters.safeParse({ leadId: "x", stageId: "y" }).success).toBe(false);
    expect(
      tool.parameters.safeParse({
        leadId: "11111111-1111-4111-8111-111111111111",
        stageId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
  });

  it("list_leads aceita chamada sem nenhum argumento (todos opcionais)", () => {
    const tool = getCopilotTool("list_leads")!;
    expect(tool.parameters.safeParse({}).success).toBe(true);
  });

  it("list_leads rejeita priority fora do enum de negócio", () => {
    const tool = getCopilotTool("list_leads")!;
    expect(tool.parameters.safeParse({ priority: "urgentissimo" }).success).toBe(false);
  });

  it("get_sales_report rejeita sinceDays fora do intervalo permitido", () => {
    const tool = getCopilotTool("get_sales_report")!;
    expect(tool.parameters.safeParse({ sinceDays: 0 }).success).toBe(false);
    expect(tool.parameters.safeParse({ sinceDays: 1000 }).success).toBe(false);
    expect(tool.parameters.safeParse({ sinceDays: 30 }).success).toBe(true);
  });

  it("get_digital_presence_score e get_website_audit exigem leadId válido (UUID)", () => {
    for (const name of ["get_digital_presence_score", "get_website_audit"]) {
      const tool = getCopilotTool(name)!;
      expect(tool.parameters.safeParse({ leadId: "não-é-uuid" }).success).toBe(false);
      expect(tool.parameters.safeParse({ leadId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
    }
  });

  it("list_active_cadences aceita chamada sem nenhum argumento", () => {
    const tool = getCopilotTool("list_active_cadences")!;
    expect(tool.parameters.safeParse({}).success).toBe(true);
  });

  it("enroll_lead_in_cadence exige leadId e cadenceId válidos", () => {
    const tool = getCopilotTool("enroll_lead_in_cadence")!;
    expect(tool.parameters.safeParse({ leadId: "x", cadenceId: "y" }).success).toBe(false);
    expect(
      tool.parameters.safeParse({
        leadId: "11111111-1111-4111-8111-111111111111",
        cadenceId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
  });
});

describe("describeForConfirmation não executa a ação, só descreve", () => {
  it("create_task gera uma descrição legível a partir dos argumentos", () => {
    const tool = getCopilotTool("create_task")!;
    const description = tool.describeForConfirmation?.({
      leadId: "11111111-1111-4111-8111-111111111111",
      title: "Ligar para o cliente",
    });
    expect(description).toContain("Ligar para o cliente");
  });

  it("enroll_lead_in_cadence gera uma descrição legível a partir dos argumentos", () => {
    const tool = getCopilotTool("enroll_lead_in_cadence")!;
    const description = tool.describeForConfirmation?.({
      leadId: "11111111-1111-4111-8111-111111111111",
      cadenceId: "22222222-2222-4222-8222-222222222222",
    });
    expect(description).toContain("11111111-1111-4111-8111-111111111111");
    expect(description).toContain("22222222-2222-4222-8222-222222222222");
  });
});
