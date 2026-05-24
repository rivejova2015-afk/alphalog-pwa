"use client";

import { useEffect, useState } from "react";
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
import { GripVertical, Pause, Play, Eye } from "lucide-react";
import { toast } from "sonner";

interface SlaveNode {
  id: string;
  account_id: string;
  role: "master" | "slave";
  status: "active" | "paused" | "read_only";
  risk_pct: number;
  account?: { id: string; name: string; currency: string } | null;
}

interface Props {
  copyGroupId: string;
  initialSlaves: SlaveNode[];
  onReorderCommitted?: () => void;
}

// Sortable list of slave nodes for a copy group. Drag/drop is optimistic:
// UI updates immediately, then PATCHes /api/copy-groups/[id]/nodes/reorder
// in the background. On failure we rollback to the previous order and toast.
export function SortableSlavesList({ copyGroupId, initialSlaves, onReorderCommitted }: Props) {
  // Local mirror of the slaves list so drag updates feel instant.
  const [slaves, setSlaves] = useState<SlaveNode[]>(initialSlaves);
  const [savingOrder, setSavingOrder] = useState(false);

  // Re-sync when parent data refreshes (e.g. user added a node elsewhere).
  useEffect(() => {
    setSlaves(initialSlaves);
  }, [initialSlaves]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistOrder = async (orderedIds: string[], previous: SlaveNode[]) => {
    setSavingOrder(true);
    try {
      const res = await fetch(`/api/copy-groups/${copyGroupId}/nodes/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      if (!res.ok) {
        // Rollback to previous order and surface error.
        setSlaves(previous);
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "No se pudo guardar el nuevo orden");
        return;
      }
      toast.success("Orden actualizado");
      onReorderCommitted?.();
    } catch {
      setSlaves(previous);
      toast.error("Error de conexión");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = slaves.findIndex((s) => s.id === active.id);
    const newIndex = slaves.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = slaves;
    const reordered = arrayMove(slaves, oldIndex, newIndex);
    setSlaves(reordered);
    void persistOrder(reordered.map((s) => s.id), previous);
  };

  if (slaves.length === 0) {
    return (
      <p className="text-xs text-[#475569]">No hay slaves en este grupo.</p>
    );
  }

  return (
    <div className="space-y-2" aria-busy={savingOrder}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slaves.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {slaves.map((slave) => (
              <SortableSlaveRow key={slave.id} slave={slave} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {savingOrder && (
        <p className="text-[10px] text-[#475569] italic">Guardando orden…</p>
      )}
    </div>
  );
}

function SortableSlaveRow({ slave }: { slave: SlaveNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slave.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const statusColor =
    slave.status === "active"
      ? "#34d399"
      : slave.status === "paused"
        ? "#f97316"
        : "#94a3b8";

  const StatusIcon = slave.status === "active" ? Play : slave.status === "paused" ? Pause : Eye;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-2.5 ${
        isDragging ? "ring-2 ring-[#22d3ee]" : "hover:bg-[#151b28]"
      } transition-colors`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-[#475569] hover:text-[#94a3b8]"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical size={14} />
      </button>
      <StatusIcon size={12} style={{ color: statusColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#e2e8f0] truncate">
          {slave.account?.name ?? slave.account_id.slice(0, 8)}
        </p>
        <p className="text-[10px] text-[#475569] font-mono">
          {slave.account?.currency ?? "—"} · risk {slave.risk_pct.toFixed(2)}%
        </p>
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider rounded border px-1.5 py-0.5"
        style={{ color: statusColor, borderColor: `${statusColor}40` }}
      >
        {slave.status}
      </span>
    </li>
  );
}
