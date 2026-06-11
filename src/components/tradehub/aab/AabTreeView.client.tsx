"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useDroppable,
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
import { GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui";
import { wouldCreateCycle, classifyDrop, type DropKind, type ActiveDragInfo } from "@/lib/copygroups/cycleCheck";

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

// Data attached to each draggable/droppable so onDragEnd can tell reorder
// (same parent) from reparent (drop onto a node in a different parent).
type NodeDndData = ActiveDragInfo;

// Maps a drop classification to the border/highlight applied to the hovered
// target while a drag is in progress.
function dropBorderClass(kind: DropKind): string | null {
  if (kind === "reorder" || kind === "valid") return "border-emerald-400 bg-emerald-500/5 ring-2 ring-emerald-400/50";
  if (kind === "invalid") return "border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/50";
  return null;
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

function ChildrenGroup({
  parentAccountId,
  childNodes,
  depth,
  selectedNodeId,
  onSelectNode,
  evaluateDrop,
}: {
  parentAccountId: string;
  childNodes: TreeNode[];
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  evaluateDrop: (active: NodeDndData | null | undefined, targetAccountId: string, targetParentId: string | null) => DropKind;
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
            evaluateDrop={evaluateDrop}
          />
        ))}
      </div>
    </SortableContext>
  );
}

// A draggable slave node (grip handle) that is also a drop target for reparent.
function SortableNodeRow({
  treeNode,
  depth,
  parentAccountId,
  selectedNodeId,
  onSelectNode,
  evaluateDrop,
}: {
  treeNode: TreeNode;
  depth: number;
  parentAccountId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  evaluateDrop: (active: NodeDndData | null | undefined, targetAccountId: string, targetParentId: string | null) => DropKind;
}) {
  const data: NodeDndData = {
    parentId: parentAccountId,
    accountId: treeNode.node.account_id,
    linkId: treeNode.linkFromParent?.id ?? null,
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active } = useSortable({
    id: treeNode.node.id,
    data,
  });
  const isSelected = selectedNodeId === treeNode.node.id;
  const hasChildren = treeNode.children.length > 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dropKind = isOver && !isDragging ? evaluateDrop(active?.data?.current as NodeDndData, data.accountId, data.parentId) : null;
  const hoverBorder = dropBorderClass(dropKind);
  const borderClass = isSelected
    ? "border-emerald-400 bg-emerald-500/10"
    : hoverBorder
      ? hoverBorder
      : isDragging
        ? "border-cyan-500 ring-2 ring-cyan-500 bg-slate-900/60"
        : "border-slate-700 bg-slate-900/60";

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? true : undefined}
      className="space-y-2"
    >
      <div className={`relative flex items-stretch gap-1 ${isDragging ? "opacity-40" : ""}`} style={{ marginLeft: depth * 16 }}>
        <button
          {...attributes}
          {...listeners}
          className="flex items-center justify-center min-w-[44px] rounded-lg text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Arrastrar para mover ${treeNode.node.account?.name || "cuenta"}`}
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => onSelectNode(treeNode.node.id)}
          className={`flex-1 text-left border rounded-xl px-4 py-3 transition ${borderClass}`}
        >
          <NodeInner treeNode={treeNode} />
        </button>
        {dropKind === "invalid" && (
          <span className="absolute top-1 right-1 text-rose-400" aria-hidden="true">
            <X size={14} />
          </span>
        )}
      </div>

      <ChildrenGroup
        parentAccountId={treeNode.node.account_id}
        childNodes={treeNode.children}
        depth={depth + 1}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        evaluateDrop={evaluateDrop}
      />
    </div>
  );
}

// The master is the immovable root: not draggable, but a valid drop target so
// a deep slave can be reparented straight up to the master.
function MasterNodeRow({
  treeNode,
  selectedNodeId,
  onSelectNode,
  evaluateDrop,
}: {
  treeNode: TreeNode;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  evaluateDrop: (active: NodeDndData | null | undefined, targetAccountId: string, targetParentId: string | null) => DropKind;
}) {
  const data: NodeDndData = { parentId: null, accountId: treeNode.node.account_id, linkId: null };
  const { setNodeRef, isOver, active } = useDroppable({ id: treeNode.node.id, data });
  const isSelected = selectedNodeId === treeNode.node.id;
  const hasChildren = treeNode.children.length > 0;

  const dropKind = isOver ? evaluateDrop(active?.data?.current as NodeDndData, data.accountId, data.parentId) : null;
  const hoverBorder = dropBorderClass(dropKind);
  const borderClass = isSelected
    ? "border-emerald-400 bg-emerald-500/10"
    : hoverBorder
      ? hoverBorder
      : "border-slate-700 bg-slate-900/60";

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? true : undefined}
      className="space-y-2"
    >
      <div className="relative">
        <button
          ref={setNodeRef}
          onClick={() => onSelectNode(treeNode.node.id)}
          className={`w-full text-left border rounded-xl px-4 py-3 transition ${borderClass}`}
        >
          <NodeInner treeNode={treeNode} />
        </button>
        {dropKind === "invalid" && (
          <span className="absolute top-1 right-1 text-rose-400" aria-hidden="true">
            <X size={14} />
          </span>
        )}
      </div>
      <ChildrenGroup
        parentAccountId={treeNode.node.account_id}
        childNodes={treeNode.children}
        depth={1}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        evaluateDrop={evaluateDrop}
      />
    </div>
  );
}

interface PendingReparent {
  linkId: string;
  draggedAccountId: string;
  draggedName: string;
  newParentAccountId: string;
  newParentName: string;
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
  const [pendingReparent, setPendingReparent] = useState<PendingReparent | null>(null);
  const [reparenting, setReparenting] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes]);

  const sensors = useSensors(
    // Mouse: tiny drag threshold so a click still selects. Touch: long-press so
    // a tap selects but holding 250ms starts the drag (mobile-first).
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const accountName = (accountId: string) =>
    localNodes.find((n) => n.account_id === accountId)?.account?.name || "Cuenta";

  const evaluateDrop = (active: NodeDndData | null | undefined, targetAccountId: string, targetParentId: string | null): DropKind =>
    classifyDrop(links, active, targetAccountId, targetParentId);

  const activeNode = activeNodeId ? localNodes.find((n) => n.id === activeNodeId) : null;

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
      setAnnouncement("Orden actualizado");
      onReorderCommitted?.();
    } catch {
      setLocalNodes(previous);
      toast.error("Error de conexión");
    } finally {
      setSavingOrder(false);
    }
  };

  const reorderSiblings = (parentAccountId: string, activeId: string, overId: string) => {
    const ids = siblingNodeIds(parentAccountId);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = arrayMove(ids, oldIndex, newIndex);
    const previous = localNodes;
    const rank = new Map(newOrder.map((id, i) => [id, i] as const));
    setLocalNodes((prev) => prev.map((n) => (rank.has(n.id) ? { ...n, sort_index: rank.get(n.id)! } : n)));
    void persistOrder(newOrder, previous);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveNodeId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveNodeId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const a = active.data.current as NodeDndData | undefined;
    const o = over.data.current as NodeDndData | undefined;
    if (!a || !o) return;

    // Same parent → reorder among siblings (Fase 2).
    if (a.parentId !== null && a.parentId === o.parentId) {
      reorderSiblings(a.parentId, active.id as string, over.id as string);
      return;
    }

    // Different target → reparent: the drop target node becomes the new parent.
    const newParentAccountId = o.accountId;
    if (!a.linkId) return; // only nodes with a parent link can be reparented
    if (newParentAccountId === a.parentId) return; // already its parent — no-op

    if (wouldCreateCycle(links, a.accountId, newParentAccountId)) {
      toast.error("Ese movimiento crearía un ciclo");
      return;
    }

    setPendingReparent({
      linkId: a.linkId,
      draggedAccountId: a.accountId,
      draggedName: accountName(a.accountId),
      newParentAccountId,
      newParentName: accountName(newParentAccountId),
    });
  };

  const doReparent = async () => {
    if (!pendingReparent || !copyGroupId) return;
    setReparenting(true);
    try {
      const res = await fetch(
        `/api/copy-groups/${copyGroupId}/links/${pendingReparent.linkId}/reparent`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_parent_account_id: pendingReparent.newParentAccountId }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "No se pudo mover el nodo");
        return;
      }
      toast.success("Nodo movido");
      setAnnouncement(`${pendingReparent.draggedName} movido como hijo de ${pendingReparent.newParentName}`);
      onReorderCommitted?.();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setReparenting(false);
      setPendingReparent(null);
    }
  };

  return (
    <div className="space-y-4" aria-busy={savingOrder || reparenting}>
      <div aria-live="polite" className="sr-only">{announcement}</div>

      {!tree.root && (
        <div className="text-sm text-slate-400">No hay master activo. Agrega un nodo master para iniciar el árbol.</div>
      )}

      {tree.root && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveNodeId(null)}
        >
          <div role="tree" aria-label="Árbol de cuentas del CopyGroup">
            <MasterNodeRow
              treeNode={tree.root}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              evaluateDrop={evaluateDrop}
            />
          </div>
          <DragOverlay>
            {activeNode ? (
              <div className="border border-cyan-400 ring-2 ring-cyan-400 rounded-xl px-4 py-3 bg-slate-800 shadow-2xl opacity-90">
                <div className="text-sm font-semibold text-slate-100">{activeNode.account?.name || "Cuenta"}</div>
                <div className="text-xs text-slate-400">{activeNode.role.toUpperCase()} • {activeNode.status}</div>
              </div>
            ) : null}
          </DragOverlay>
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

      <ConfirmDialog
        open={pendingReparent !== null}
        title="Mover nodo"
        message={
          pendingReparent
            ? `¿Mover "${pendingReparent.draggedName}" como hijo de "${pendingReparent.newParentName}"? Esto cambia la topología de mirroring activa.`
            : ""
        }
        variant="warning"
        confirmLabel="Mover"
        cancelLabel="Cancelar"
        onCancel={() => setPendingReparent(null)}
        onConfirm={doReparent}
      />
    </div>
  );
}
