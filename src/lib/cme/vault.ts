import { getLatticeSecret, setLatticeSecret, deleteLatticeSecret } from "../lattice-secrets";

const PROJECT = "alphalog-cme";

function vaultKey(connectionId: string): string {
  return `cme-access:${connectionId}`;
}

// Rotación del token de Tradovate: `setLatticeSecret` inserta/actualiza la
// fila de "Secret" sin tocar `rotateEveryDays` (columna existente, default
// null en la BD -- ver lattice-server/api/prisma/schema.prisma). Decidir un
// valor concreto (ej. 30/60/90 días) es una decisión de producto, no
// técnica; queda pendiente de decisión explícita del usuario en vez de
// inventar un número acá.
export async function storeCmeAccessToken(connectionId: string, token: string): Promise<void> {
  await setLatticeSecret(PROJECT, vaultKey(connectionId), token);
}

export async function readCmeAccessToken(connectionId: string): Promise<string | null> {
  return getLatticeSecret(PROJECT, vaultKey(connectionId));
}

export async function deleteCmeAccessToken(connectionId: string): Promise<void> {
  await deleteLatticeSecret(PROJECT, vaultKey(connectionId));
}
