"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus } from "lucide-react";

interface Category {
  id: string;
  name: string;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/account-categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Error fetching categories");
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
    if (!formName.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      setError("");
      const method = editingCategory ? "PATCH" : "POST";
      const body = editingCategory
        ? { id: editingCategory.id, name: formName }
        : { name: formName };

      const response = await fetch("/api/account-categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to save category");
      }

      // Optimistic update
      const savedCategory = await response.json();
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
      fetchCategories(); // Refetch for consistency
    } catch (err: any) {
      setError(err?.message || "Error saving category");
    }
  };

  // Handle delete (soft delete)
  const handleDelete = async (id: string) => {
    try {
      setError("");
      const response = await fetch("/api/account-categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to delete category");
      }

      // Optimistic removal
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      setDeleteConfirm(null);
      fetchCategories(); // Refetch for consistency
    } catch (err: any) {
      setError(err?.message || "Error deleting category");
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
    setFormName("");
    setError("");
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
                      onClick={() => handleDelete(category.id)}
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
    </div>
  );
}
