-- Migration 070: Supabase Vault for critical bot secrets
-- Vault encrypts secrets at the DB level with a separate KMS key.
-- Requires vault extension (enabled by default in Supabase projects).

BEGIN;

-- Enable the vault extension if not already active
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Create a helper function to store a named secret in vault
-- Usage: SELECT store_vault_secret('bot_webhook_secret_prod', 'my-secret-value');
CREATE OR REPLACE FUNCTION public.store_vault_secret(
  p_name TEXT,
  p_secret TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.store_vault_secret(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_vault_secret(TEXT, TEXT, TEXT) TO service_role;

-- Helper to read a vault secret by name
CREATE OR REPLACE FUNCTION public.read_vault_secret(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decrypted TEXT;
BEGIN
  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;
  RETURN v_decrypted;
END;
$$;

REVOKE ALL ON FUNCTION public.read_vault_secret(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_vault_secret(TEXT) TO service_role;

COMMIT;
