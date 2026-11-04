import type { Metadata } from "next";
import Link from "next/link";
import { Clock, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Retorno do checkout — FinderFlow AI" };

/**
 * Página de retorno do checkout (docs/05-integrations.md §5.2, item
 * "Página de retorno (somente informativa)" — FF-064). **Nunca** ativa
 * ou confirma nenhum plano: o redirect do navegador não é confiável como
 * confirmação de pagamento (Asaas documenta isso explicitamente —
 * "must not be used as financial confirmation" — conferido em
 * docs.asaas.com durante a implementação). A confirmação real só chega
 * pelo webhook (`/api/v1/webhooks/asaas`), de forma assíncrona.
 */
export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { result } = await searchParams;

  const isCancelOrExpired = result === "cancel" || result === "expired";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Conta e assinatura" title="Retorno do checkout" />

      <Card className="flex flex-col items-center gap-4 text-center">
        <span
          className={`flex size-12 items-center justify-center rounded-full ${
            isCancelOrExpired
              ? "bg-[#421c2a] text-[var(--ff-danger)]"
              : "bg-[#3c3016] text-[var(--ff-warning)]"
          }`}
        >
          {isCancelOrExpired ? (
            <XCircle className="size-6" aria-hidden />
          ) : (
            <Clock className="size-6" aria-hidden />
          )}
        </span>

        {isCancelOrExpired ? (
          <>
            <h2 className="text-lg font-semibold text-[var(--ff-text-primary)]">Checkout não concluído</h2>
            <p className="max-w-md text-sm text-[var(--ff-text-secondary)]">
              O checkout foi cancelado ou expirou antes do pagamento. Nenhum plano foi ativado. Você pode
              tentar novamente quando quiser.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[var(--ff-text-primary)]">
              Pagamento em processamento
            </h2>
            <p className="max-w-md text-sm text-[var(--ff-text-secondary)]">
              Recebemos a confirmação de que você concluiu o checkout — mas isto é apenas informativo. O
              plano só é ativado quando o Asaas confirma o pagamento de forma assíncrona (normalmente em
              poucos instantes). Atualize a página de assinatura para ver o estado mais recente.
            </p>
          </>
        )}

        <Link href="/billing">
          <Button>Ver status da assinatura</Button>
        </Link>
      </Card>
    </div>
  );
}
