/**
 * Catálogo estático de segmentos → códigos CNAE Fiscal, usado para
 * traduzir a busca em linguagem natural ("clínicas odontológicas em
 * Salvador") para o filtro que o provedor de dados (Receita Federal /
 * Minha Receita) de fato entende: código de CNAE + UF.
 *
 * Cada entrada foi verificada ao vivo contra a API pública do Minha
 * Receita (`GET /?cnae_fiscal=<code>`) antes de entrar aqui — a
 * descrição oficial devolvida pela Receita foi conferida manualmente
 * contra o rótulo em português, porque a numeração do CNAE não é
 * intuitiva (ex.: 8630501 a 8630504 são todos "atividade médica
 * ambulatorial", mas só o 8630504 é especificamente odontológico;
 * tentativas anteriores "por memória" acertaram menos da metade).
 * Nenhum código aqui é um palpite da IA — ver `cnae-resolver.ts` para
 * como a IA é usada (apenas para escolher entre estas entradas já
 * verificadas, nunca para inventar um código novo).
 *
 * Cobertura deliberadamente parcial: são ~20 segmentos comuns para o
 * público inicial do FinderFlow AI (freelancers, agências digitais,
 * consultorias, pequenas empresas de serviços B2B) e alguns segmentos
 * de consumo final frequentes em prospecção local. Expandir esta lista
 * é seguro e incremental — sempre verificando o código contra a API
 * antes de adicionar (ver docs/DECISIONS.md).
 */

export interface CnaeCatalogEntry {
  /** Identificador estável da entrada (usado pela IA para escolher sem inventar código). */
  key: string;
  /** Rótulo legível, usado na UI e no prompt da IA. */
  label: string;
  /** Um ou mais códigos de CNAE Fiscal (7 dígitos, sem máscara) que representam o segmento. */
  cnaeCodes: string[];
  /** Palavras-chave (minúsculas, sem acento) para casar com busca livre antes de recorrer à IA. */
  keywords: string[];
}

export const CNAE_CATALOG: CnaeCatalogEntry[] = [
  {
    key: "restaurantes",
    label: "Restaurantes e lanchonetes",
    cnaeCodes: ["5611201", "5611203"],
    keywords: ["restaurante", "restaurantes", "lanchonete", "lanchonetes", "pizzaria", "comida"],
  },
  {
    key: "clinicas_odontologicas",
    label: "Clínicas odontológicas",
    cnaeCodes: ["8630504"],
    keywords: ["odontolog", "dentista", "dentistas", "clinica odontologica", "clinicas odontologicas"],
  },
  {
    key: "clinicas_medicas",
    label: "Clínicas médicas (consultas)",
    cnaeCodes: ["8630503"],
    keywords: ["clinica medica", "clinicas medicas", "consultorio medico", "medico", "medicos"],
  },
  {
    key: "academias",
    label: "Academias e condicionamento físico",
    cnaeCodes: ["9313100"],
    keywords: ["academia", "academias", "crossfit", "pilates", "ginastica"],
  },
  {
    key: "estetica_beleza",
    label: "Salões de beleza e estética",
    cnaeCodes: ["9602501", "9602502"],
    keywords: ["salao de beleza", "cabeleireiro", "cabeleireiros", "estetica", "manicure", "barbearia"],
  },
  {
    key: "advocacia",
    label: "Escritórios de advocacia",
    cnaeCodes: ["6911701"],
    keywords: ["advocacia", "advogado", "advogados", "escritorio de advocacia"],
  },
  {
    key: "contabilidade",
    label: "Escritórios de contabilidade",
    cnaeCodes: ["6920601"],
    keywords: ["contabilidade", "contador", "contadores", "escritorio de contabilidade", "contabil"],
  },
  {
    key: "agencias_publicidade",
    label: "Agências de publicidade e marketing",
    cnaeCodes: ["7311400"],
    keywords: ["agencia de publicidade", "agencia de marketing", "marketing digital", "publicidade"],
  },
  {
    key: "desenvolvimento_software",
    label: "Desenvolvimento de software",
    cnaeCodes: ["6201501"],
    keywords: ["software", "desenvolvimento de sistemas", "fabrica de software", "programacao"],
  },
  {
    key: "consultoria_ti",
    label: "Consultoria em tecnologia da informação",
    cnaeCodes: ["6204000"],
    keywords: ["consultoria de ti", "consultoria em ti", "consultoria tecnologia"],
  },
  {
    key: "construcao_edificios",
    label: "Construção de edifícios",
    cnaeCodes: ["4120400"],
    keywords: ["construtora", "construtoras", "construcao civil", "construcao de edificios"],
  },
  {
    key: "corretagem_imoveis",
    label: "Corretagem e avaliação de imóveis",
    cnaeCodes: ["6821801"],
    keywords: ["imobiliaria", "imobiliarias", "corretor de imoveis", "corretagem de imoveis"],
  },
  {
    key: "comercio_veiculos_novos",
    label: "Comércio de veículos novos",
    cnaeCodes: ["4511101"],
    keywords: ["concessionaria", "concessionarias", "venda de carros novos", "revenda de veiculos"],
  },
  {
    key: "reparacao_computadores",
    label: "Reparação de computadores e periféricos",
    cnaeCodes: ["9511800"],
    keywords: ["assistencia tecnica", "conserto de computador", "manutencao de informatica"],
  },
  {
    key: "hoteis",
    label: "Hotéis",
    cnaeCodes: ["5510801"],
    keywords: ["hotel", "hoteis", "pousada", "pousadas"],
  },
  {
    key: "consultoria_gestao",
    label: "Consultoria em gestão empresarial",
    cnaeCodes: ["7020400"],
    keywords: ["consultoria empresarial", "consultoria de gestao", "consultoria estrategica"],
  },
  {
    key: "comercio_vestuario",
    label: "Comércio varejista de vestuário",
    cnaeCodes: ["4781400"],
    keywords: ["loja de roupa", "loja de roupas", "boutique", "vestuario"],
  },
  {
    key: "ensino_idiomas",
    label: "Ensino de idiomas",
    cnaeCodes: ["8593700"],
    keywords: ["escola de idiomas", "curso de ingles", "curso de idiomas"],
  },
  {
    key: "veterinaria",
    label: "Clínicas veterinárias",
    cnaeCodes: ["7500100"],
    keywords: ["clinica veterinaria", "veterinario", "veterinarios", "pet"],
  },
  {
    key: "limpeza",
    label: "Limpeza em prédios e domicílios",
    cnaeCodes: ["8121400"],
    keywords: ["empresa de limpeza", "limpeza predial", "servicos de limpeza"],
  },
  {
    key: "transporte_cargas",
    label: "Transporte rodoviário de carga",
    cnaeCodes: ["4930202"],
    keywords: ["transportadora", "transportadoras", "transporte de carga", "frete"],
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Busca por palavra-chave exata/substring no catálogo (sem IA) — primeira linha de defesa, instantânea e sem custo. */
export function matchCatalogByKeyword(text: string): CnaeCatalogEntry | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  for (const entry of CNAE_CATALOG) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry;
    }
  }
  return null;
}

export function getCatalogEntryByKey(key: string): CnaeCatalogEntry | null {
  return CNAE_CATALOG.find((entry) => entry.key === key) ?? null;
}
