"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { saveOrganizationProfileAction, type ProfileActionResult } from "@/modules/organizations/profile.actions";
import type { OrganizationProfile } from "@/modules/organizations/profile.service";

const initialState: ProfileActionResult = { success: false };

/**
 * "Perfil" cadastral da organização (pessoa jurídica ou física) — não é
 * uma credencial de API: é a identidade de quem está prospectando (nome,
 * WhatsApp, o que vende). A IA usa isso para assinar e-mails de
 * prospecção com uma identidade real e sempre convidar o lead a
 * continuar a conversa pelo WhatsApp informado aqui (ver
 * `modules/ai/prompts.ts` `buildOutreachGeneratorInput`).
 */
export function OrganizationProfileForm({ profile }: { profile: OrganizationProfile }) {
  const [state, formAction, isPending] = useActionState(saveOrganizationProfileAction, initialState);
  const [personType, setPersonType] = useState(profile.personType);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--ff-text-secondary)]">
          Você prospecta como
        </label>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--ff-text-primary)]">
            <input
              type="radio"
              name="personType"
              value="company"
              checked={personType === "company"}
              onChange={() => setPersonType("company")}
            />
            Empresa (pessoa jurídica)
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--ff-text-primary)]">
            <input
              type="radio"
              name="personType"
              value="individual"
              checked={personType === "individual"}
              onChange={() => setPersonType("individual")}
            />
            Profissional autônomo (pessoa física)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={personType === "individual" ? "Nome completo" : "Razão social"}
          name="legalName"
          defaultValue={profile.legalName ?? ""}
          placeholder={personType === "individual" ? "Ex.: João Pedro Ribeiro" : "Ex.: Minha Agência Ltda."}
        />
        <Field
          label={personType === "individual" ? "Como quer ser chamado" : "Nome fantasia"}
          name="tradeName"
          defaultValue={profile.tradeName ?? ""}
          placeholder="Como a IA deve se apresentar nos e-mails"
        />
        <Field
          label={personType === "individual" ? "CPF" : "CNPJ"}
          name="document"
          defaultValue={profile.document ?? ""}
          placeholder={personType === "individual" ? "000.000.000-00" : "00.000.000/0000-00"}
        />
        <Field
          label="Nome de quem assina o e-mail"
          name="senderName"
          defaultValue={profile.senderName ?? ""}
          placeholder="Ex.: João"
        />
        <Field
          label="E-mail de contato"
          name="email"
          type="email"
          defaultValue={profile.email ?? ""}
          placeholder="contato@voce.com"
        />
        <Field
          label="Telefone"
          name="phone"
          defaultValue={profile.phone ?? ""}
          placeholder="(00) 0000-0000"
        />
        <Field
          label="WhatsApp (usado pela IA para convidar o lead a continuar a conversa lá)"
          name="whatsappNumber"
          defaultValue={profile.whatsappNumber ?? ""}
          placeholder="(00) 00000-0000"
          className="sm:col-span-2"
        />
        <Field
          label="Site/portfólio"
          name="website"
          defaultValue={profile.website ?? ""}
          placeholder="https://..."
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cidade" name="addressCity" defaultValue={profile.addressCity ?? ""} />
          <Field label="UF" name="addressState" defaultValue={profile.addressState ?? ""} maxLength={2} placeholder="BA" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pitch" className="text-sm font-medium text-[var(--ff-text-secondary)]">
          O que você vende (em uma ou duas frases)
        </label>
        <textarea
          id="pitch"
          name="pitch"
          defaultValue={profile.pitch ?? ""}
          rows={3}
          placeholder="Ex.: Crio sites e sistemas sob medida para pequenos negócios que ainda não têm presença online ou usam ferramentas manuais."
          className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
        />
        <p className="text-xs text-[var(--ff-text-muted)]">
          A IA usa isso como base real da oferta ao gerar e-mails de prospecção — nunca inventa outro
          serviço. Cada e-mail ainda é adaptado à empresa específica do lead, não é um texto fixo.
        </p>
      </div>

      {state.message ? (
        <p role="alert" className={`text-sm ${state.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
          {state.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}
