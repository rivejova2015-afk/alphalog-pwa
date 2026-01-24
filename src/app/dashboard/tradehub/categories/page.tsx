"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [reassigningCategory, setReassigningCategory] = useState<Category | null>(null);
  const [reassignMode, setReassignMode] = useState<"existing" | "new">("existing");
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [reassignError, setReassignError] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/account-categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error fetching categories";
      setError(message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Handle save (create/update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    const trimmedDescription = formDescription.trim();

    if (!trimmedName) {
      setError("Category name is required");
      return;
    }

    try {
      setError("");
      const method = editingCategory ? "PATCH" : "POST";
      const body = editingCategory
        ? { id: editingCategory.id, name: trimmedName, description: trimmedDescription || null }
        : { name: trimmedName, description: trimmedDescription || null };

      const response = await fetch("/api/account-categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save category");
      }

      const savedCategory = payload;
      if (editingCategory) {
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === savedCategory.id ? savedCategory : cat
          )
        );
      } else {
        setCategories((prev) => [savedCategory, ...prev]);
      }

      setShowDialog(false);
      setEditingCategory(null);
      setFormName("");
      setFormDescription("");
      fetchCategories(); // Refetch for consistency
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error saving category";
      setError(message);
    }
  };

  // Handle delete (soft delete)
  const handleDelete = async (category: Category) => {
    try {
      setError("");
      const response = await fetch("/api/account-categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id }),
      });

      const errData = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errData?.error === "reassign_required") {
          const remaining = categories.filter((cat) => cat.id !== category.id);
          setReassigningCategory(category);
          setReassignMode(remaining.length > 0 ? "existing" : "new");
          setTargetCategoryId(remaining[0]?.id || "");
          setDeleteConfirm(null);
          return;
        }
        throw new Error(errData?.error || "Failed to delete category");
      }

      // Optimistic removal
      setCategories((prev) => prev.filter((cat) => cat.id !== category.id));
      setDeleteConfirm(null);
      fetchCategories(); // Refetch for consistency
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error deleting category";
      setError(message);
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormDescription(category.description || "");
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
    setFormName("");
    setFormDescription("");
    setError("");
  };

  const handleReassignAndDelete = async () => {
    if (!reassigningCategory) return;
    const payload: Record<string, unknown> = { id: reassigningCategory.id };

    if (reassignMode === "existing") {
      if (!targetCategoryId) {
        setReassignError("Selecciona una categoría de destino");
        return;
      }
      payload.reassignTo = targetCategoryId;
    } else {
      if (!newCategoryName.trim()) {
        setReassignError("Nombre para la nueva categoría requerido");
        return;
      }
      payload.createNew = {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || null,
      };
    }

    try {
      setReassignLoading(true);
      setReassignError("");
      const response = await fetch("/api/account-categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const respData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(respData?.error || "No se pudo eliminar");
      }

      setReassigningCategory(null);
      setNewCategoryName("");
      setNewCategoryDescription("");
      setTargetCategoryId("");
      fetchCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al re-asignar cuentas";
      setReassignError(message);
    } finally {
      setReassignLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Categorías</h2>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona las categorías de tus cuentas
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setFormName("");
            setFormDescription("");
            setShowDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
        >
          <Plus size={18} />
          Nueva Categoría
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Categories list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">No hay categorías creadas aún</p>
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormName("");
              setFormDescription("");
              setShowDialog(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
          >
            <Plus size={18} />
            Crear primera categoría
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-50">{category.name}</h3>
                  {category.description && (
                    <p className="text-sm text-slate-300 mt-1">{category.description}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(category.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditDialog(category)}
                    className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(category.id)}
                    className="p-2 hover:bg-red-900/30 text-red-400 rounded transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirm === category.id && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded">
                  <p className="text-sm text-red-300 mb-2">
                    ¿Eliminar esta categoría?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(category)}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog Modal */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-slate-900 border border-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">
              {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Scalping, Swing, Day Trading..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Notas rápidas sobre cuándo usar esta categoría"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  {editingCategory ? "Guardar" : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassigningCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-lg bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Reasigna las cuentas antes de eliminar</h3>
                <p className="text-sm text-slate-400 mt-1">
                  La categoría {reassigningCategory.name} tiene cuentas asociadas. Muévelas a otra categoría o crea una nueva.
                </p>
              </div>
              <button
                onClick={() => {
                  setReassigningCategory(null);
                  setReassignError("");
                }}
                className="text-slate-400 hover:text-slate-200"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="reassign-existing"
                  checked={reassignMode === "existing"}
                  onChange={() => setReassignMode("existing")}
                  disabled={categories.filter((c) => c.id !== reassigningCategory.id).length === 0}
                />
                <label htmlFor="reassign-existing" className="text-sm text-slate-200">
                  Mover a una categoría existente
                </label>
              </div>

              {reassignMode === "existing" && (
                <div className="pl-7 space-y-2">
                  <label className="block text-sm text-slate-300">Selecciona categoría</label>
                  <select
                    value={targetCategoryId}
                    onChange={(e) => setTargetCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Selecciona...</option>
                    {categories
                      .filter((cat) => cat.id !== reassigningCategory.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="reassign-new"
                  checked={reassignMode === "new"}
                  onChange={() => setReassignMode("new")}
                />
                <label htmlFor="reassign-new" className="text-sm text-slate-200">
                  Crear una nueva categoría y mover cuentas
                </label>
              </div>

              {reassignMode === "new" && (
                <div className="pl-7 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre de la nueva categoría</label>
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      placeholder="Ej: Propfirm Futuros"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Descripción (opcional)</label>
                    <textarea
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      rows={2}
                      placeholder="Notas rápidas"
                    />
                  </div>
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
                  setReassigningCategory(null);
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
  );
}
