-- Migration 119: CHECK constraint en provider_name de algo_cme_accounts
-- para alinear con las 4 propfirms del wizard. Previene typos silenciosos
-- (ej. 'apex' lowercase) que romperían el match contra PROPFIRM_RULES.
--
-- Aplica solo si account_type='propfirm'. Cuentas broker mantienen TEXT libre
-- (broker names varían y no son enforced por PROPFIRM_RULES).

ALTER TABLE public.algo_cme_accounts
  ADD CONSTRAINT algo_cme_accounts_propfirm_provider_check
    CHECK (
      account_type <> 'propfirm'
      OR provider_name IN ('Apex', 'Lucid Trading', 'MyFundedFutures', 'Tradeify')
    );

NOTIFY pgrst, 'reload schema';
