import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { Database } from "@/types/database";

type BillingPaymentRow = Database["public"]["Tables"]["billing_payments"]["Row"];

const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);
const OVERDUE_STATUSES = new Set(["OVERDUE"]);

function statusVariant(status: string): BadgeProps["variant"] {
  if (PAID_STATUSES.has(status)) return "success";
  if (OVERDUE_STATUSES.has(status)) return "danger";
  return "outline";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export function PaymentHistoryTable({ payments }: { payments: BillingPaymentRow[] }) {
  return (
    <Card>
      <CardHeader
        title="Histórico de cobranças"
        subtitle="Sincronizado a partir dos eventos de pagamento do Asaas (nunca inferido a partir do redirect do checkout)."
      />
      {payments.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">Nenhuma cobrança registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--ff-text-muted)]">
                <th className="py-2 pr-4">Vencimento</th>
                <th className="py-2 pr-4">Valor</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Pago em</th>
                <th className="py-2">Fatura</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-[var(--ff-border-subtle)]">
                  <td className="py-2 pr-4 text-[var(--ff-text-primary)]">{formatDate(payment.due_date)}</td>
                  <td className="py-2 pr-4 text-[var(--ff-text-primary)]">{formatCurrency(Number(payment.amount))}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={statusVariant(payment.status)}>{payment.status}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-[var(--ff-text-secondary)]">{formatDate(payment.paid_at)}</td>
                  <td className="py-2">
                    {payment.invoice_url ? (
                      <a
                        href={payment.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--ff-violet-glow)] hover:underline"
                      >
                        Ver fatura
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
