-- Correção: o default ACL deste projeto hoje concede EXECUTE a `anon`
-- automaticamente na criação de qualquer função nova (ver pg_default_acl),
-- diferente do momento em que as funções de credenciais Asaas/OpenAI/Gmail
-- foram criadas (Fase 9) — "revoke all ... from public" não revoga uma
-- concessão já feita diretamente ao papel `anon`. Replicando o padrão já
-- usado em outras migrations (ex.: 20261107194500_fase10_foundations.sql)
-- de revogar `anon` explicitamente. Mantido como migration separada para
-- espelhar exatamente o que foi aplicado ao banco (ver
-- 20261108054539_module2_website_audit.sql, que já nasce com `anon`
-- incluído no revoke para qualquer ambiente novo criado a partir do zero).
revoke all on function public.set_org_pagespeed_credentials(uuid, text) from anon;
revoke all on function public.clear_org_pagespeed_credentials(uuid) from anon;
revoke all on function public.get_org_pagespeed_api_key(uuid) from anon;
