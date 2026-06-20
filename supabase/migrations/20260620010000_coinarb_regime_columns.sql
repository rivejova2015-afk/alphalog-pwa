-- Migration: Phase 5 — agrega columna `regime` a las 4 tablas coinarb para
-- persistir el régimen de mercado detectado por classifyRegime() en cada
-- decisión, posición y trade. La columna es nullable porque:
--   - rows pre-Phase 2 (cuando el coordinator empiece a escribir) no tienen
--     regime asociado, y queremos preservarlas sin migración de datos
--   - el classifier puede retornar undefined si los candles están en warmup
-- El index parcial sobre coinarb_decisions acelera las queries del dashboard
-- "decisiones por régimen últimas 24h" sin pesar en INSERTs porque sólo
-- indexa rows con regime no-NULL.

alter table coinarb_telemetry  add column if not exists regime text;
alter table coinarb_decisions  add column if not exists regime text;
alter table coinarb_positions  add column if not exists regime text;
alter table coinarb_trades     add column if not exists regime text;

-- Index sobre decisions para el dashboard de distribución por régimen.
-- (kind, created_at desc) está cubierto por idx_coinarb_decisions_created_at
-- ya existente; este nuevo index sólo se justifica filtrando por regime.
create index if not exists idx_coinarb_decisions_regime
  on coinarb_decisions (regime, kind, created_at desc)
  where regime is not null;

-- CHECK constraint para acotar los valores válidos. Si una nueva variante
-- de Regime se agrega al type literal en regime-detector.ts, esta CHECK
-- también debe extenderse — el TS type y el SQL CHECK quedan acoplados a
-- propósito (single source of truth en SQL para el runtime).
alter table coinarb_telemetry
  drop constraint if exists coinarb_telemetry_regime_check;
alter table coinarb_telemetry
  add constraint coinarb_telemetry_regime_check
  check (regime is null or regime in ('TRENDING_HIGH','TRENDING_LOW','RANGE_HIGH','RANGE_LOW','DEAD'));

alter table coinarb_decisions
  drop constraint if exists coinarb_decisions_regime_check;
alter table coinarb_decisions
  add constraint coinarb_decisions_regime_check
  check (regime is null or regime in ('TRENDING_HIGH','TRENDING_LOW','RANGE_HIGH','RANGE_LOW','DEAD'));

alter table coinarb_positions
  drop constraint if exists coinarb_positions_regime_check;
alter table coinarb_positions
  add constraint coinarb_positions_regime_check
  check (regime is null or regime in ('TRENDING_HIGH','TRENDING_LOW','RANGE_HIGH','RANGE_LOW','DEAD'));

alter table coinarb_trades
  drop constraint if exists coinarb_trades_regime_check;
alter table coinarb_trades
  add constraint coinarb_trades_regime_check
  check (regime is null or regime in ('TRENDING_HIGH','TRENDING_LOW','RANGE_HIGH','RANGE_LOW','DEAD'));

comment on column coinarb_telemetry.regime is
  'Market regime at last heartbeat, computed by classifyRegime(). NULL during warmup or before Phase 2 dispatch is live.';
comment on column coinarb_decisions.regime is
  'Regime at decision time. NULL for decisions logged before Phase 2 of multi-strategy refactor.';
comment on column coinarb_positions.regime is
  'Regime at open. Carries forward to coinarb_trades.regime on close.';
comment on column coinarb_trades.regime is
  'Regime at entry, propagated from position. Powers per-regime PnL analysis.';
