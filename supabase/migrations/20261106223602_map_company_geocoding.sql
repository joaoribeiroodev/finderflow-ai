-- Aba "Mapa" (evolução pedida pelo usuário 2026-11-06): empresas
-- plotadas num mapa Leaflet/OpenStreetMap, coloridas pela etapa do
-- pipeline. A Receita Federal (Minha Receita) não retorna latitude/
-- longitude, só endereço — por isso geocodificamos uma vez por empresa
-- via Nominatim (OpenStreetMap, gratuito) e guardamos o resultado aqui,
-- nunca repetindo a chamada para o mesmo endereço.
--
-- `geocode_failed_at`: marca tentativa sem resultado (endereço não
-- encontrado pelo Nominatim) para não tentar de novo a cada carga da
-- página — aceitável como "não vai aparecer no mapa" em vez de bater no
-- provedor externo repetidamente para o mesmo endereço ruim.
alter table public.companies
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_failed_at timestamptz;

comment on column public.companies.latitude is 'Geocodificado via Nominatim (OpenStreetMap) a partir do endereço — ver src/lib/geo/nominatim-geocoder.ts';
comment on column public.companies.longitude is 'Geocodificado via Nominatim (OpenStreetMap) a partir do endereço — ver src/lib/geo/nominatim-geocoder.ts';

-- Índice parcial para a fila de backfill (só empresas sem coordenada,
-- sem falha registrada, ainda não arquivadas) — é exatamente o filtro
-- usado por `geocodeNextBatch`.
create index if not exists companies_geocode_queue_idx
  on public.companies (organization_id, created_at)
  where latitude is null and geocode_failed_at is null and archived_at is null;
