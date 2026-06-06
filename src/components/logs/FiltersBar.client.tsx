// src/components/logs/FiltersBar.client.tsx
"use client";

import { useState, useEffect } from "react";
import CategorySelect from "./CategorySelect.client";
import TrashToggle from "./TrashToggle.client";

import { logError } from "@/lib/log";
interface Category {
  id: string;
  name: string;
}

interface FiltersBarProps {
  onFiltersChange: (filters: {
    query: string;
    categoryId: string;
    type: string;
    trash: boolean;
  }) => void;
}

export default function FiltersBar({ onFiltersChange }: FiltersBarProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const [trash, setTrash] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    onFiltersChange({ query, categoryId, type, trash });
  }, [query, categoryId, type, trash]);

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.items || []);
      }
    } catch (error) {
      logError("FiltersBar", { component: "filtersbar", message: "Error loading categories", error: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        padding: "16px",
        backgroundColor: "#f9fafb",
        borderRadius: "6px",
        marginBottom: "16px",
      }}
    >
      {/* Search */}
      <div>
        <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
          Buscar
        </label>
        <input
          type="text"
          placeholder="Buscar en título o notas..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
          }}
        />
      </div>

      {/* Category */}
      <div>
        <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
          Categoría
        </label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            backgroundColor: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">Todas</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Type */}
      <div>
        <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
          Tipo
        </label>
        <input
          type="text"
          placeholder="Filtrar por tipo..."
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
          }}
        />
      </div>

      {/* Trash toggle */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-start" }}>
        <TrashToggle isTrash={trash} onChange={setTrash} />
      </div>
    </div>
  );
}
