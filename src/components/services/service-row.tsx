"use client";

import { useState } from "react";
import { Pencil, Power } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils/format";
import { PRICING_TYPE_LABELS, type PricingType } from "@/lib/validation/services";
import { toggleServiceActiveAction } from "@/modules/services/actions";
import type { ServiceRow as ServiceRowType } from "@/modules/services/services.service";

import { ServiceForm } from "./service-form";

export function ServiceRow({ service }: { service: ServiceRowType }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="border-b border-[var(--ff-border-subtle)] p-4 last:border-b-0">
        <ServiceForm service={service} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-[var(--ff-border-subtle)] p-4 last:border-b-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--ff-text-primary)]">{service.name}</span>
          {!service.is_active ? <Badge variant="outline">Inativo</Badge> : null}
        </div>
        <p className="text-xs text-[var(--ff-text-secondary)]">
          {PRICING_TYPE_LABELS[service.pricing_type as PricingType]}
          {service.base_price !== null ? ` · ${formatBRL(Number(service.base_price))}` : " · preço sob proposta"}
        </p>
        {service.description ? (
          <p className="max-w-xl text-xs text-[var(--ff-text-muted)]">{service.description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Editar ${service.name}`}
          className="flex size-8 items-center justify-center rounded-lg text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
        >
          <Pencil className="size-4" />
        </button>
        <form action={toggleServiceActiveAction}>
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="isActive" value={(!service.is_active).toString()} />
          <button
            type="submit"
            aria-label={service.is_active ? `Desativar ${service.name}` : `Ativar ${service.name}`}
            title={service.is_active ? "Desativar" : "Ativar"}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
          >
            <Power className="size-4" />
          </button>
        </form>
      </div>
    </li>
  );
}
