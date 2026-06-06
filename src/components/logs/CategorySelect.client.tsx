// src/components/logs/CategorySelect.client.tsx
"use client";

import { useState, useEffect } from "react";
import SeedCategoriesButton from "./SeedCategoriesButton.client";

import { logError } from "@/lib/log";
interface Category {
  id: string;
  name: string;
}

interface CategorySelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  onCategoriesRefresh?: () => void;
}

export default function CategorySelect({
  value,
  onChange,
  onCategoriesRefresh,
}: CategorySelectProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.items || []);
      }
    } catch (error) {
      logError("CategorySelect", { component: "categoryselect", message: "Error loading categories", error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSeedSuccess = () => {
    loadCategories();
    onCategoriesRefresh?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937" }}>
        Categoría *
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        style={{
          padding: "8px 12px",
          fontSize: "14px",
          border: "1px solid #d1d5db",
          borderRadius: "4px",
          backgroundColor: "#fff",
          cursor: "pointer",
        }}
      >
        <option value="">Selecciona una categoría...</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      {categories.length === 0 && !loading && (
        <SeedCategoriesButton onSuccess={handleSeedSuccess} />
      )}
    </div>
  );
}
