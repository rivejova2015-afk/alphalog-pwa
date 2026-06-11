"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

interface AccountSummary {
  id: string;
  name: string;
  currency: string;
  status: string;
  operation_state: string | null;
  phase_status: string | null;
  role: string | null;
}

interface CopyGroupNode {
  id: string;
  account_id: string;
  role: "master" | "slave";
  status: "active" | "paused" | "read_only";
  risk_pct: number;
  sort_index: number;
  account?: AccountSummary | null;
}

interface CopyGroupLink {
  id: string;
  parent_account_id: string;
  child_account_id: string;
  copy_multiplier: number;
  link_type: "solid" | "shadow";
}

interface TreeNode {
  node: CopyGroupNode;
  children: TreeNode[];
  linkFromParent?: CopyGroupLink;
  multiplierPath: number;
}

// Shared inner content of a node card (name, role/status, multiplier path).
function NodeInner({ treeNode }: { treeNode: TreeNode }) {
  const account = treeNode.node.account;
  const link = treeNode.linkFromParent;
  const linkLabel = link ? `${link.link_type === "solid" ? "Solid" : "Shadow"} ×${link.copy_multiplier}` : null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">{account?.name || "Cuenta"}</div>
        <div className="text-xs text-slate-400">
          {treeNode.node.role.toUpperCase()} • {treeNode.node.status} • Risk {treeNode.node.risk_pct}%
        </div>
      </div>
      <div className="text-right text-xs text-slate-400">
        <div>Multiplier path: ×{treeNode.multiplierPath.toFixed(3)}</div>
        {linkLabel && <div>{linkLabel}</div>}
      </div>
    </div>
  );
}

// Children of a node form an independent sortable list (siblings sharing the
// same parent). Reorder within this list is the only DnD operation in Fase 2;
// reparent across lists lands in Fase 3.
function ChildrenGroup({
  parentAccountId,
  childNodes,
  depth,
  selectedNodeId,
  onSelectNode,
}: {
  parentAccountId: string;
  childNodes: TreeNode[];
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  if (childNodes.length === 0) return null;
  return (
    <SortableContext items={childNodes.map((c) => c.node.id)} strategy={verticalListSortingStrategy}>
      <div role="group" className="space-y-2">
        {childNodes.map((child) => (
          <SortableNodeRow
            key={child.node.id}
            treeNode={child}
            depth={depth}
            parentAccountId={parentAccountId}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ))}
      </div>
    </SortableContext>
  );
}

// A draggable slave node (has a grip handle). Recurses into its own children.
function SortableNodeRow({
  treeNode,
  depth,
  parentAccountId,
  selectedNodeId,
  onSelectNode,
}: {
  treeNode: TreeNode;
  depth: number;
  parentAccountId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: treeNode.node.id,
    data: { parentId: parentAccountId },
  });
  const isSelected = selectedNodeId === treeNode.node.id;
  const hasChildren = treeNode.children.length > 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? true : undefined}
      className="space-y-2"
    >
      <div className={`flex items-stretch gap-1 ${isDragging ? "opacity-40" : ""}`} style={{ marginLeft: depth * 16 }}>
        <button
          {...attributes}
          {...listeners}
          className="flex items-center px-1 rounded-lg text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Arrastrar para reordenar ${treeNode.node.account?.name || "cuenta"}`}
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => onSelectNode(treeNode.node.id)}
          className={`flex-1 text-left border rounded-xl px-4 py-3 transition ${
            isSelected
              ? "border-emerald-400 bg-emerald-500/10"
              : isDragging
                ? "border-cyan-500 ring-2 ring-cyan-500 bg-slate-900/60"
                : "border-slate-700 bg-slate-900/60"
          }`}
        >
          <NodeInner treeNode={treeNode} />
        </button>
      </div>

      <ChildrenGroup
        parentAccountId={treeNode.node.account_id}
        childNodes={treeNode.children}
        depth={depth + 1}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
    </div>
  );
}

export default function AabTreeView({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
  copyGroupId,
  onReorderCommitted,
}: {
  nodes: CopyGroupNode[];
  links: CopyGroupLink[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  copyGroupId: string | null;
  onReorderCommitted?: () => void;
}) {
  // Local mirror so drag reorders feel instant. Re-synced when the parent
  // refetches the graph (e.g. after a node/link mutation elsewhere).
  const [localNodes, setLocalNodes] = useState<CopyGroupNode[]>(nodes);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tree = useMemo(() => {
    const nodeMap = new Map(localNodes.map((n) => [n.account_id, n]));
    const linksByParent = new Map<string, CopyGroupLink[]>();

    links.forEach((link) => {
      if (!linksByParent.has(link.parent_account_id)) {
        linksByParent.set(link.parent_account_id, []);
      }
      linksByParent.get(link.parent_account_id)?.push(link);
    });

    const rootNode =
      localNodes.find((n) => n.role === "master" && n.status === "active") ||
      localNodes.find((n) => n.role === "master") ||
      null;

    if (!rootNode) {
      return { root: null as TreeNode | null, orphans: localNodes };
    }

    const visited = new Set<string>();

    const buildTree = (accountId: string, multiplierPath: number): TreeNode | null => {
      if (visited.has(accountId)) return null;
      visited.add(accountId);

      const node = nodeMap.get(accountId);
      if (!node) return null;

      // Order children by their node's sort_index so persisted reorder shows up.
      const childLinks = (linksByParent.get(accountId) || []).slice().sort((a, b) => {
        const na = nodeMap.get(a.child_account_id);
        const nb = nodeMap.get(b.child_account_id);
        return (na?.sort_index ?? 0) - (nb?.sort_index ?? 0);
      });

      const children = childLinks
        .map((link) => {
          const childMultiplier = multiplierPath * (Number(link.copy_multiplier) || 1);
          const childTree = buildTree(link.child_account_id, childMultiplier);
          if (!childTree) return null;
          return { ...childTree, linkFromParent: link, multiplierPath: childMultiplier };
        })
        .filter(Boolean) as TreeNode[];

      return { node, children, multiplierPath };
    };

    const rootTree = buildTree(rootNode.account_id, 1);
    const orphanNodes = localNodes.filter((n) => !visited.has(n.account_id));

    return { root: rootTree, orphans: orphanNodes };
  }, [localNodes, links]);

  // Node IDs of a parent's children, in current persisted order.
  const siblingNodeIds = (parentAccountId: string): string[] => {
    const nodeMap = new Map(localNodes.map((n) => [n.account_id, n]));
    return links
      .filter((l) => l.parent_account_id === parentAccountId)
      .map((l) => nodeMap.get(l.child_account_id))
      .filter((n): n is CopyGroupNode => Boolean(n))
      .sort((a, b) => a.sort_index - b.sort_index)
      .map((n) => n.id);
  };

  const persistOrder = async (orderedIds: string[], previous: CopyGroupNode[]) => {
    if (!copyGroupId) return;
    setSavingOrder(true);
    try {
      const res = await fetch(`/api/copy-groups/${copyGroupId}/nodes/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      if (!res.ok) {
        setLocalNodes(previous);
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "No se pudo guardar el nuevo orden");
        return;
      }
      toast.success("Orden actualizado");
      onReorderCommitted?.();
    } catch {
      setLocalNodes(previous);
      toast.error("Error de conexión");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeParent = active.data.current?.parentId as string | undefined;
    const overParent = over.data.current?.parentId as string | undefined;

    // Fase 2 = reorder dentro del mismo padre. Mover entre padres (reparent)
    // llega en la Fase 3 con su propio endpoint.
    if (!activeParent || !overParent) return;
    if (activeParent !== overParent) {
      toast.message("Mover un nodo a otro padre llega en una próxima fase");
      return;
    }

    const ids = siblingNodeIds(activeParent);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = arrayMove(ids, oldIndex, newIndex);
    const previous = localNodes;
    const rank = new Map(newOrder.map((id, i) => [id, i] as const));

    // Optimistic: rewrite sort_index of the affected siblings to match newOrder.
    setLocalNodes((prev) => prev.map((n) => (rank.has(n.id) ? { ...n, sort_index: rank.get(n.id)! } : n)));
    void persistOrder(newOrder, previous);
  };

  return (
    <div className="space-y-4" aria-busy={savingOrder}>
      {!tree.root && (
        <div className="text-sm text-slate-400">No hay master activo. Agrega un nodo master para iniciar el árbol.</div>
      )}

      {tree.root && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div role="tree" aria-label="Árbol de cuentas del CopyGroup">
            {/* Master root: no es arrastrable (es la raíz). */}
            <div
              role="treeitem"
              aria-selected={selectedNodeId === tree.root.node.id}
              aria-expanded={tree.root.children.length > 0 ? true : undefined}
              className="space-y-2"
            >
              <button
                onClick={() => onSelectNode(tree.root!.node.id)}
                className={`w-full text-left border rounded-xl px-4 py-3 transition ${
                  selectedNodeId === tree.root.node.id
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900/60"
                }`}
              >
                <NodeInner treeNode={tree.root} />
              </button>
              <ChildrenGroup
                parentAccountId={tree.root.node.account_id}
                childNodes={tree.root.children}
                depth={1}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
              />
            </div>
          </div>
        </DndContext>
      )}

      {savingOrder && <p className="text-[11px] text-slate-500 italic">Guardando orden…</p>}

      {tree.orphans.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs uppercase text-slate-400 mb-2">Nodos sin conexión</div>
          <div className="space-y-2">
            {tree.orphans.map((node) => (
              <button
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`w-full text-left border rounded-lg px-3 py-2 transition ${
                  selectedNodeId === node.id ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700 bg-slate-900/60"
                }`}
              >
                <div className="text-sm text-slate-100">{node.account?.name || "Cuenta"}</div>
                <div className="text-xs text-slate-400">{node.role.toUpperCase()} • {node.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
