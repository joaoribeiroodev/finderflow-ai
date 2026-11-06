/**
 * Tipos e constantes compartilhados entre o serviço server-only
 * (`map.service.ts`) e o componente cliente do mapa
 * (`src/components/map/companies-map.tsx`). Separado em arquivo próprio
 * sem `import "server-only"` — se ficasse dentro de `map.service.ts`, o
 * componente cliente arrastaria todo o módulo server-only (Supabase,
 * Nominatim) para o bundle do navegador, o que o Next.js corretamente
 * rejeita no build.
 */

/** Cor neutra para empresas sem lead ativo (não entraram no pipeline ainda). */
export const MAP_NEUTRAL_COLOR = "#6b7280";

export interface MapCompanyPoint {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  stageId: string | null;
  stageName: string | null;
  stageColor: string;
  leadId: string | null;
}

export interface StageLegendEntry {
  id: string;
  name: string;
  color: string;
}
