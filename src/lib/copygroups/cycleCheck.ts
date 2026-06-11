// Client-side mirror of the DB function `copy_group_would_create_cycle`
// (migration 024). Used by AabTreeView to block a reparent drop *before*
// hitting the server when it would create a cycle. The DB trigger
// `copy_group_links_guard` is still the source of truth — this is just UX.

export interface CycleLink {
  parent_account_id: string;
  child_account_id: string;
}

/**
 * True if making `newParentAccountId` the parent of `draggedAccountId` would
 * create a cycle — i.e. the proposed new parent is already a descendant of the
 * dragged node (BFS over the link graph), or they are the same node.
 */
export function wouldCreateCycle(
  links: CycleLink[],
  draggedAccountId: string,
  newParentAccountId: string,
): boolean {
  if (draggedAccountId === newParentAccountId) return true;

  const visited = new Set<string>([draggedAccountId]);
  const queue: string[] = [draggedAccountId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const link of links) {
      if (link.parent_account_id !== current) continue;
      const child = link.child_account_id;
      if (child === newParentAccountId) return true;
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }
  return false;
}

export type DropKind = "reorder" | "valid" | "invalid" | null;

export interface ActiveDragInfo {
  accountId: string;
  parentId: string | null;
  linkId: string | null;
}

/**
 * Classifies what would happen if the active (dragged) node were dropped onto a
 * target node, for live hover feedback in the tree:
 *   - "reorder": same parent → reorder among siblings (valid, green)
 *   - "valid":   reparent onto a different node (valid, green)
 *   - "invalid": self-parent, already-parent, orphan with no link, or cycle (red)
 *   - null:      hovering over itself / nothing actionable
 */
export function classifyDrop(
  links: CycleLink[],
  active: ActiveDragInfo | null | undefined,
  targetAccountId: string,
  targetParentId: string | null,
): DropKind {
  if (!active) return null;
  if (active.accountId === targetAccountId) return null; // over itself
  if (active.parentId !== null && active.parentId === targetParentId) return "reorder";

  // Reparent path.
  if (!active.linkId) return "invalid"; // orphan: no parent link to move
  if (targetAccountId === active.parentId) return "invalid"; // already its parent
  if (wouldCreateCycle(links, active.accountId, targetAccountId)) return "invalid";
  return "valid";
}
