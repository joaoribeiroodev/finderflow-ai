-- Módulo 5 — Recomendação de Serviços.
--
-- Achado importante (ver docs/DECISIONS.md): o Company Analyzer (Fase 5)
-- já produz `opportunities` (serviço + motivo + prioridade), ancoradas no
-- catálogo real de serviços da organização, e isso já é exibido na página
-- da empresa. Este módulo NÃO duplica essa IA — ele cria a view abaixo
-- para agregar as oportunidades já geradas em uma lista única, cruzando
-- todas as empresas — hoje só dá para ver oportunidade por oportunidade,
-- abrindo empresa por empresa.
--
-- Por isso "reaproveitar ai_analyses, sem tabela nova" (ETAPA-0-AUDITORIA.md
-- §7) é respeitado literalmente: nenhuma tabela nova é criada. Esta é uma
-- VIEW de leitura, não uma tabela — não armazena nada por si só. Ela usa
-- `security_invoker = true` (Postgres 17, confirmado no projeto) para que a
-- RLS de `ai_analyses` e `companies` seja aplicada com o papel de quem está
-- consultando (sem isso, a view correria com os privilégios de quem a
-- criou, ignorando RLS — risco clássico de view sem security_invoker).
create view public.latest_company_service_opportunities
  with (security_invoker = true)
as
with latest_analysis as (
  select distinct on (a.company_id)
    a.id as analysis_id,
    a.organization_id,
    a.company_id,
    a.result,
    a.score as company_score,
    a.created_at as analyzed_at
  from public.ai_analyses a
  where a.analysis_type = 'company_analysis' and a.company_id is not null
  order by a.company_id, a.created_at desc
)
select
  la.organization_id,
  la.company_id,
  c.name as company_name,
  la.analysis_id,
  la.company_score,
  la.analyzed_at,
  (opp ->> 'service_id')::uuid as service_id,
  opp ->> 'service_name' as service_name,
  opp ->> 'reason' as reason,
  opp ->> 'priority' as priority
from latest_analysis la
join public.companies c on c.organization_id = la.organization_id and c.id = la.company_id
cross join lateral jsonb_array_elements(coalesce(la.result -> 'opportunities', '[]'::jsonb)) as opp
where c.archived_at is null;

comment on view public.latest_company_service_opportunities is
  'Módulo 5 — achata as oportunidades (opportunities) da análise de IA mais recente (analysis_type=company_analysis) de cada empresa não arquivada. security_invoker=true: respeita a RLS de ai_analyses/companies de quem consulta.';
