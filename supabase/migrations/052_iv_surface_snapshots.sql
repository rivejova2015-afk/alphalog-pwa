-- Migration 052: Implied volatility surface snapshots (Heston model, immutable)

CREATE TABLE IF NOT EXISTS public.iv_surface_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL DEFAULT '381e268e-a042-4612-8b39-7a120ace17d6',
  instrument          TEXT NOT NULL DEFAULT 'XAUUSD',
  snapshot_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  heston_kappa        DECIMAL(18,8) NOT NULL,
  heston_theta        DECIMAL(18,8) NOT NULL,
  heston_sigma        DECIMAL(18,8) NOT NULL,
  heston_rho          DECIMAL(18,8) NOT NULL CHECK (heston_rho BETWEEN -1 AND 1),
  heston_v0           DECIMAL(18,8) NOT NULL,
  surface_grid        JSONB NOT NULL DEFAULT '[]',
  spot_price          DECIMAL(18,4) NOT NULL,
  realized_vol_15m    DECIMAL(10,6) NULL,
  realized_vol_1h     DECIMAL(10,6) NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iv_surface_snapshots_instrument_at
  ON public.iv_surface_snapshots(instrument, snapshot_at DESC);

ALTER TABLE public.iv_surface_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY iv_surface_snapshots_select_own ON public.iv_surface_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY iv_surface_snapshots_insert_own ON public.iv_surface_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY iv_surface_snapshots_delete_own ON public.iv_surface_snapshots
  FOR DELETE USING (auth.uid() = user_id);
