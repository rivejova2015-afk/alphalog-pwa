// Mirror Health Heatmap
// Calcula el estado de salud de cada rama (verde/ámbar/rojo) según replicated/failed/need_resync.

export type MirrorStatus = "replicated" | "failed" | "need_resync";

export interface MirrorNode {
  id: string;
  label: string;
  status: MirrorStatus;
  children?: MirrorNode[];
}

export function computeHealthHeatmap(root: MirrorNode): Record<string, MirrorStatus> {
  const result: Record<string, MirrorStatus> = {};
  function traverse(node: MirrorNode) {
    result[node.id] = node.status;
    node.children?.forEach(traverse);
  }
  traverse(root);
  return result;
}
