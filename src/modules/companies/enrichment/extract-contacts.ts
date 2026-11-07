/**
 * Extração puramente determinística de contatos a partir do HTML de um
 * site (Módulo 1 — Enriquecimento Inteligente). Nunca usa IA: um link
 * `mailto:`/`tel:`/de rede social que está de fato na página é um fato
 * observado diretamente, não uma inferência — ver docs/DECISIONS.md
 * ("nunca inventar fatos, distinguir fato de hipótese"). Extração
 * baseada em IA (ex.: ler o texto da página para achar um telefone sem
 * link `tel:`) fica deliberadamente fora desta fase — incremento futuro,
 * se necessário.
 *
 * Função pura (sem I/O) para ser testável sem rede — quem busca o HTML é
 * `enrichment.service.ts`.
 */

export type ExtractedFieldKey =
  | "email"
  | "phone"
  | "website"
  | "social_instagram"
  | "social_facebook"
  | "social_linkedin"
  | "social_tiktok"
  | "social_youtube"
  | "social_twitter";

export interface ExtractedField {
  fieldKey: ExtractedFieldKey;
  fieldValue: string;
  source: string;
  confidence: number;
}

interface SocialPattern {
  key: ExtractedFieldKey;
  hostSuffixes: string[];
}

const SOCIAL_PATTERNS: SocialPattern[] = [
  { key: "social_instagram", hostSuffixes: ["instagram.com"] },
  { key: "social_facebook", hostSuffixes: ["facebook.com", "fb.com"] },
  { key: "social_linkedin", hostSuffixes: ["linkedin.com"] },
  { key: "social_tiktok", hostSuffixes: ["tiktok.com"] },
  { key: "social_youtube", hostSuffixes: ["youtube.com", "youtu.be"] },
  { key: "social_twitter", hostSuffixes: ["twitter.com", "x.com"] },
];

// Links "de template"/genéricos que não identificam o perfil da própria
// empresa (botão de compartilhar, link de login, página de explorar).
const GENERIC_PATH_PATTERN = /\/(sharer|share|intent|explore|login|dialog)(\/|$|\?)/i;

function hostMatchesSuffix(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** Extrai e-mails de links `mailto:`. Confiança alta: é um link clicável de contato, não um texto solto que poderia ser outra coisa. */
function extractMailtoEmails(html: string, sourceUrl: string, push: (f: ExtractedField) => void): void {
  for (const match of html.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)) {
    let email: string;
    try {
      email = decodeURIComponent(match[1]).trim().toLowerCase();
    } catch {
      continue;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      push({ fieldKey: "email", fieldValue: email, source: `website_scan:mailto:${sourceUrl}`, confidence: 0.95 });
    }
  }
}

/** Extrai telefones de links `tel:`. */
function extractTelPhones(html: string, sourceUrl: string, push: (f: ExtractedField) => void): void {
  for (const match of html.matchAll(/href\s*=\s*["']tel:([^"']+)/gi)) {
    let raw: string;
    try {
      raw = decodeURIComponent(match[1]);
    } catch {
      continue;
    }
    const phone = raw.replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length >= 8) {
      push({ fieldKey: "phone", fieldValue: phone, source: `website_scan:tel:${sourceUrl}`, confidence: 0.9 });
    }
  }
}

/** Extrai links para perfis de redes sociais conhecidas. */
function extractSocialLinks(html: string, sourceUrl: string, push: (f: ExtractedField) => void): void {
  for (const match of html.matchAll(/href\s*=\s*["'](https?:\/\/[^"'\s]+)["']/gi)) {
    const href = match[1];
    let host: string;
    try {
      host = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (GENERIC_PATH_PATTERN.test(href)) continue;

    const pattern = SOCIAL_PATTERNS.find((p) => p.hostSuffixes.some((suffix) => hostMatchesSuffix(host, suffix)));
    if (pattern) {
      push({ fieldKey: pattern.key, fieldValue: href, source: `website_scan:social:${sourceUrl}`, confidence: 0.85 });
    }
  }
}

/**
 * Extrai todos os campos de contato encontráveis no HTML de uma página,
 * deduplicados por `fieldKey` + `fieldValue` (case-insensitive).
 */
export function extractContactFields(html: string, sourceUrl: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  const push = (field: ExtractedField) => {
    const dedupeKey = `${field.fieldKey}:${field.fieldValue.toLowerCase()}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    fields.push(field);
  };

  extractMailtoEmails(html, sourceUrl, push);
  extractTelPhones(html, sourceUrl, push);
  extractSocialLinks(html, sourceUrl, push);

  return fields;
}
