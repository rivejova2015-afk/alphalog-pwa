// Branch Diff Viewer
// Compara dos versiones de un árbol de CopyGroups y muestra los cambios (nodes, links, risk%, multipliers).

export interface BranchNode {
  id: string;
  label: string;
  multiplier: number;
  risk: number;
  children?: BranchNode[];
}

export interface BranchDiff {
  added: BranchNode[];
  removed: BranchNode[];
  changed: { id: string; from: BranchNode; to: BranchNode }[];
}

export function diffBranches(oldTree: BranchNode, newTree: BranchNode): BranchDiff {
  const oldMap = new Map<string, BranchNode>();
  const newMap = new Map<string, BranchNode>();
  function flatten(node: BranchNode, map: Map<string, BranchNode>) {
    map.set(node.id, node);
    node.children?.forEach(child => flatten(child, map));
  }
  flatten(oldTree, oldMap);
  flatten(newTree, newMap);

  const added = Array.from(newMap.values()).filter(n => !oldMap.has(n.id));
  const removed = Array.from(oldMap.values()).filter(n => !newMap.has(n.id));
  const changed = Array.from(newMap.values())
    .filter(n => oldMap.has(n.id))
    .map(n => {
      const oldN = oldMap.get(n.id)!;
      if (n.multiplier !== oldN.multiplier || n.risk !== oldN.risk) {
        return { id: n.id, from: oldN, to: n };
      }
      return null;
    })
    .filter(Boolean) as { id: string; from: BranchNode; to: BranchNode }[];

  return { added, removed, changed };
}
