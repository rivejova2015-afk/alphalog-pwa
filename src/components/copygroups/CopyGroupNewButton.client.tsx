"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CopyGroupNewButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Nombre requerido");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/copy-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const created = await res.json();
      toast.success(`Copy group "${created.name}" creado`);
      setOpen(false);
      setName("");
      router.push(`/dashboard/copy-groups/${created.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#22d3ee]/10 border border-[#22d3ee]/30 hover:bg-[#22d3ee]/20 text-[#22d3ee] text-sm font-medium rounded-md transition-colors"
      >
        <Plus size={14} />
        Nuevo grupo
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crear copy group"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-[#0f172a] border border-[#1f2937] rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-mono text-[#e2e8f0] mb-4">Nuevo copy group</h2>
            <label className="block text-xs text-[#94a3b8] mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Apex evaluations"
              autoFocus
              className="w-full bg-[#151b28] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22d3ee]/50"
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-3 py-1.5 text-sm text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#22d3ee]/10 border border-[#22d3ee]/30 hover:bg-[#22d3ee]/20 text-[#22d3ee] text-sm rounded-md disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
