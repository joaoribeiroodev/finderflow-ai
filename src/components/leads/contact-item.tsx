import { Trash2 } from "lucide-react";

import { deleteContactAction } from "@/modules/leads/crm-items.actions";
import type { ContactRow } from "@/modules/leads/leads.service";

export function ContactItem({ contact, leadId }: { contact: ContactRow; leadId: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-[var(--ff-text-primary)]">
          {contact.name}
          {contact.position ? <span className="text-[var(--ff-text-muted)]"> — {contact.position}</span> : null}
        </p>
        <p className="text-xs text-[var(--ff-text-muted)]">
          {[contact.email, contact.phone, contact.preferred_channel].filter(Boolean).join(" · ") || "Sem dados de contato adicionais"}
        </p>
      </div>
      <form action={deleteContactAction}>
        <input type="hidden" name="contactId" value={contact.id} />
        <input type="hidden" name="leadId" value={leadId} />
        <button
          type="submit"
          aria-label={`Remover contato ${contact.name}`}
          className="text-[var(--ff-text-muted)] hover:text-[var(--ff-danger)]"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </form>
    </li>
  );
}
