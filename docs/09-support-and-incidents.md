# 9. Processo de suporte e incidentes

> Rascunho escrito na Fase 8 (hardening) — descreve o processo mínimo
> viável com a equipe atual (uma pessoa). Revisar e expandir conforme a
> operação cresce (plantão, SLA formal, status page pública).

## 9.1. Canais de suporte

- Canal primário: [E-MAIL/CANAL A DEFINIR].
- Sem SLA formal definido neste estágio (pré-beta). Meta informal:
  responder solicitações de suporte em até 1 dia útil.

## 9.2. Severidade de incidentes

| Nível | Critério | Exemplo |
|---|---|---|
| SEV1 — Crítico | Indisponibilidade total, vazamento de dados, acesso cross-tenant confirmado | Login fora do ar para todos; dados de uma org visíveis para outra |
| SEV2 — Alto | Funcionalidade principal indisponível para parte dos usuários | Geração de proposta/PDF falhando; webhook de billing não processando |
| SEV3 — Médio | Funcionalidade secundária degradada, com contorno possível | IA fora do ar (provedor externo), dashboard lento |
| SEV4 — Baixo | Bug cosmético ou de baixo impacto | Texto incorreto, ícone errado |

## 9.3. Passos imediatos em qualquer incidente

1. **Confirmar o escopo**: todos os tenants ou um subconjunto? Reproduz
   em `npm run build && npm run start` local, ou só em produção?
2. **Checar os 3 lugares óbvios primeiro**:
   - `get_advisors` (Supabase) — alguma migration recente introduziu um
     achado de segurança/performance?
   - Logs estruturados (`src/lib/logger/logger.ts`, JSON por linha) —
     buscar por `requestId`/`organizationId`/`status: "failed"` no
     período do incidente.
   - Para billing: tabela `asaas_webhook_events` (status de
     processamento por evento) e `audit_logs`.
3. **Para um SEV1 de acesso cross-tenant suspeito**: tratar como
   confirmado até prova em contrário — revisar a policy de RLS da tabela
   envolvida imediatamente (ver o teste ao vivo documentado em
   `docs/DECISIONS.md` Fase 8 como modelo de verificação).
4. **Comunicar** aos assinantes afetados em linguagem clara, sem
   detalhes técnicos sensíveis, assim que o impacto for entendido — não
   esperar a causa raiz completa para avisar que há um problema
   conhecido.
5. **Corrigir, documentar em `docs/DECISIONS.md`, e só então** declarar
   o incidente encerrado.

## 9.4. Dependências externas e seus modos de falha conhecidos

- **OpenAI indisponível/rate limit**: produto já trata como estado
  "IA não configurada/falhou" honesto na UI (Fase 5) — não derruba o
  resto do produto.
- **Asaas indisponível**: webhook não processa; job de reconciliação
  (`/api/v1/jobs/billing-sync`) precisa de um scheduler externo
  configurado para convergir o estado quando o provedor voltar — **ainda
  não configurado neste ambiente**, pendência explícita (ver README.md).
- **Supabase indisponível**: todo o produto depende do Supabase; não há
  modo degradado. Acompanhar status.supabase.com.

## 9.5. Backups e recuperação (ver também `docs/08-security-operations.md` §8.4)

O projeto Supabase atual está no **plano Free**, que **não inclui backups
automáticos gerenciados nem PITR** — isso é uma limitação de
infraestrutura, não uma configuração pendente que possa ser ativada por
aqui. Antes de qualquer beta com dados reais de assinantes, migrar para
um plano com backup (Pro ou superior) é um pré-requisito, não uma
melhoria opcional. Até essa migração, não há capacidade de restauração
em caso de perda de dados além de uma exportação manual pontual.

## 9.6. Pós-incidente

Todo incidente SEV1/SEV2 ganha uma entrada em `docs/DECISIONS.md` com:
o que aconteceu, impacto, causa raiz, correção aplicada, e o que mudou
para não repetir — mesmo padrão já usado para os bugs encontrados em QA
ao longo do projeto (Fases 2 a 7).
