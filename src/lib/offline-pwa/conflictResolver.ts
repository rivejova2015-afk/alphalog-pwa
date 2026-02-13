// Conflict Resolver Silencioso
// Si hay conflicto al sync, conserva ambas versiones y marca “need_review”.

export interface ConflictItem {
  id: string;
  local: unknown;
  remote: unknown;
  status: "need_review" | "resolved";
}

export function resolveConflict<T extends { id: string }>(local: T, remote: T): ConflictItem {
  return {
    id: local.id,
    local,
    remote,
    status: "need_review"
  };
}
