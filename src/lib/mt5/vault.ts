// Vault wrapper for bot_instances.instance_secret (Task 8, Ajuste #1).
// Mirrors src/lib/cme/vault.ts: unlike the CME wrapper's namespaced key
// (`cme-access:{connectionId}`), here `name` is exactly the bot_instances.id
// (no prefix needed — project='alphalog-mt5' already disambiguates from the
// CME project's secrets in the shared "Secret" table).
import { getLatticeSecret, setLatticeSecret, deleteLatticeSecret } from "../lattice-secrets";

const PROJECT = "alphalog-mt5";

export async function storeInstanceSecret(instanceId: string, secret: string): Promise<void> {
  await setLatticeSecret(PROJECT, instanceId, secret);
}

export async function readInstanceSecret(instanceId: string): Promise<string | null> {
  return getLatticeSecret(PROJECT, instanceId);
}

export async function deleteInstanceSecret(instanceId: string): Promise<void> {
  await deleteLatticeSecret(PROJECT, instanceId);
}
