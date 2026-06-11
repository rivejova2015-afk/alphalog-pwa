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
