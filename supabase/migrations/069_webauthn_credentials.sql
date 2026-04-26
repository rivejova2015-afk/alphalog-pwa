-- Migration 069: WebAuthn / Passkey credentials table
-- Stores device-bound cryptographic keys for phishing-resistant authentication.
-- Credentials are origin-bound to alphalog.io — cannot be used on other domains.

BEGIN;

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id   TEXT NOT NULL UNIQUE,        -- base64url-encoded credential ID from authenticator
  public_key      TEXT NOT NULL,               -- CBOR-encoded public key (base64url)
  counter         BIGINT NOT NULL DEFAULT 0,   -- sign-count for replay protection
  device_type     TEXT,                        -- 'platform' | 'cross-platform'
  backed_up       BOOLEAN NOT NULL DEFAULT false,
  friendly_name   TEXT,                        -- user-provided label (e.g. "MacBook Touch ID")
  aaguid          TEXT,                        -- authenticator model identifier
  transports      TEXT[],                      -- ['internal', 'hybrid', ...]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webauthn_credentials_user_id_idx ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS webauthn_credentials_credential_id_idx ON public.webauthn_credentials(credential_id);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY webauthn_credentials_select ON public.webauthn_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY webauthn_credentials_insert ON public.webauthn_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY webauthn_credentials_update ON public.webauthn_credentials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY webauthn_credentials_delete ON public.webauthn_credentials
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
