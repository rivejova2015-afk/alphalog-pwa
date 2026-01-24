"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type DeleteReassignPayload = {
  id: string;
  reassignTo?: string | null;
  createNew?: { name: string; description?: string | null } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

function normalizeError(err: unknown, fallback = "Ocurrió un error") {
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function CategoryManagerModal({ open, onClose, onUpdated }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignMode, setReassignMode] = useState<"existing" | "new">("existing");
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDescription, setNewCatDescription] = useState("");
  const [reassignError, setReassignError] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const loadCategories = useCallback(async () => {
    if (!open) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/account-categories");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to fetch categories");
      }
      const data = (await res.json()) as Category[];
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(normalizeError(err, "Error al cargar categorías"));
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setEditingId(null);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const method = editingId ? "PATCH" : "POST";
      const payload = editingId
        ? { id: editingId, name: trimmedName, description: trimmedDescription || null }
        : { name: trimmedName, description: trimmedDescription || null };

      const res = await fetch("/api/account-categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar");
      }

      resetForm();
      void loadCategories();
      onUpdated?.();
    } catch (err) {
      setError(normalizeError(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    try {
      setError("");
      const res = await fetch("/api/account-categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "reassign_required") {
          const remaining = categories.filter((c) => c.id !== category.id);
          setDeleteTarget(category);
          setReassignMode(remaining.length > 0 ? "existing" : "new");
          setReassignTargetId(remaining[0]?.id || "");
          setNewCatName("");
          setNewCatDescription("");
          return;
        }
        throw new Error(data?.error || "No se pudo eliminar");
      }
      void loadCategories();
      onUpdated?.();
    } catch (err) {
      setError(normalizeError(err, "Error al eliminar"));
    }
  };

  const handleReassignAndDelete = async () => {
    if (!deleteTarget) return;
    const payload: DeleteReassignPayload = { id: deleteTarget.id };
    if (reassignMode === "existing") {
      if (!reassignTargetId) {
        setReassignError("Selecciona una categoría destino");
        return;
      }
      payload.reassignTo = reassignTargetId;
    } else {
      const trimmedName = newCatName.trim();
      if (!trimmedName) {
        setReassignError("Nombre requerido para la nueva categoría");
        return;
      }
      payload.createNew = {
        name: trimmedName,
        description: newCatDescription.trim() || null,
      };
    }

    try {
      setReassignLoading(true);
      setReassignError("");
      const res = await fetch("/api/account-categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo completar la reasignación");
      }
      setDeleteTarget(null);
      setNewCatName("");
      setNewCatDescription("");
      setReassignTargetId("");
      void loadCategories();
      onUpdated?.();
    } catch (err) {
      setReassignError(normalizeError(err, "Error al reasignar"));
    } finally {
      setReassignLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-3xl rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">Gestionar Categorías</h2>
            <p className="text-sm text-slate-400">Crea, renombra o elimina (con reasignación) categorías de cuentas.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-sm font-medium text-slate-200">Nueva categoría</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              disabled={saving}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              rows={3}
              disabled={saving}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-60"
              >
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
              </button>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                  disabled={saving}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-200">Categorías existentes</h3>
              {loading && <span className="text-xs text-slate-400">Cargando...</span>}
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
              {sortedCategories.length === 0 && !loading && (
                <p className="text-sm text-slate-400">No hay categorías creadas.</p>
              )}
              {sortedCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-lg border border-slate-800 bg-slate-850/50 px-3 py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-100">{cat.name}</div>
                    {cat.description && (
                      <div className="text-xs text-slate-400 mt-1">{cat.description}</div>
                    )}
                    <div className="text-[11px] text-slate-500 mt-1">
                      Creada: {new Date(cat.created_at).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setName(cat.name);
                        setDescription(cat.description || "");
                      }}
                      className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800 text-red-200 rounded"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reassign modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-lg rounded-lg bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-slate-50">Reasignar cuentas antes de eliminar</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    La categoría {deleteTarget.name} tiene cuentas asociadas. Muévelas a otra categoría o crea una nueva.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setDeleteTarget(null);
                    setReassignError("");
                  }}
                  className="text-slate-400 hover:text-slate-200"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 text-sm text-slate-200">
                  <input
                    type="radio"
                    checked={reassignMode === "existing"}
                    onChange={() => setReassignMode("existing")}
                    disabled={sortedCategories.filter((c) => c.id !== deleteTarget.id).length === 0}
                  />
                  Mover a categoría existente
                </label>
                {reassignMode === "existing" && (
                  <div className="pl-7 space-y-2">
                    <select
                      value={reassignTargetId}
                      onChange={(e) => setReassignTargetId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Selecciona...</option>
                      {sortedCategories
                        .filter((c) => c.id !== deleteTarget.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-500">Se permite elegir la misma categoría (no recomendado).</p>
                  </div>
                )}

                <label className="flex items-center gap-3 text-sm text-slate-200">
                  <input
                    type="radio"
                    checked={reassignMode === "new"}
                    onChange={() => setReassignMode("new")}
                  />
                  Crear nueva categoría y mover cuentas
                </label>
                {reassignMode === "new" && (
                  <div className="pl-7 space-y-3">
                    <input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      placeholder="Nombre de la nueva categoría"
                    />
                    <textarea
                      value={newCatDescription}
                      onChange={(e) => setNewCatDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      placeholder="Descripción (opcional)"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {reassignError && (
                <div className="p-3 rounded bg-red-900/20 border border-red-800 text-sm text-red-200">
                  {reassignError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReassignAndDelete}
                  disabled={reassignLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-60"
                >
                  {reassignLoading ? "Reasignando..." : "Reasignar y eliminar"}
                </button>
                <button
                  onClick={() => {
                    setDeleteTarget(null);
                    setReassignError("");
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
