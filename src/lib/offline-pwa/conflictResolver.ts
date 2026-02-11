// Conflict Resolver Silencioso
// Si hay conflicto al sync, conserva ambas versiones y marca “need_review”.

export interface ConflictItem {
  id: string;
  local: any;
  remote: any;
  status: "need_review" | "resolved";
}

export function resolveConflict(local: any, remote: any): ConflictItem {
  return {
    id: local.id,
    local,
    remote,
    status: "need_review"
  };
}
