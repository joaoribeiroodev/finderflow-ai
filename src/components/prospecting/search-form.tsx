"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/error-state";
import { searchCompaniesAction, type SearchActionResult } from "@/modules/prospecting/actions";

const initialState: SearchActionResult = { success: false };

export function ProspectingSearchForm() {
  const [state, formAction, isPending] = useActionState(searchCompaniesAction, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="O que você procura" name="query" placeholder="Ex.: restaurantes, clínicas, academias" required />
          <Field label="Segmento (opcional)" name="segment" placeholder="Ex.: alimentação" />
          <Field label="Cidade (opcional)" name="city" />
          <Field label="UF (opcional)" name="state" maxLength={2} placeholder="BA" />
        </div>
        <div>
          <Button type="submit" disabled={isPending} size="sm">
            <Search className="mr-2 size-4" aria-hidden /> {isPending ? "Buscando..." : "Buscar empresas"}
          </Button>
        </div>
      </form>

      {state.providerNotConfigured ? (
        <ErrorState
          title="Busca automática ainda não está disponível"
          description="Nenhum provedor de dados de empresas foi integrado ainda — essa escolha depende de avaliar cobertura, custo e política de uso de cada opção (decisão registrada em docs/DECISIONS.md). Enquanto isso, cadastre manualmente ou importe uma planilha CSV."
          action={
            <Link href="/companies/import">
              <Button size="sm" variant="secondary">
                Importar CSV
              </Button>
            </Link>
          }
        />
      ) : state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
