import { getLatticeSecret, setLatticeSecret, deleteLatticeSecret } from "../lattice-secrets";

const PROJECT = "alphalog-cme";

function vaultKey(connectionId: string): string {
  return `cme-access:${connectionId}`;
}

export async function storeCmeAccessToken(connectionId: string, token: string): Promise<void> {
  await setLatticeSecret(PROJECT, vaultKey(connectionId), token);
}

export async function readCmeAccessToken(connectionId: string): Promise<string | null> {
  return getLatticeSecret(PROJECT, vaultKey(connectionId));
}

export async function deleteCmeAccessToken(connectionId: string): Promise<void> {
  await deleteLatticeSecret(PROJECT, vaultKey(connectionId));
}
