// src/components/tradehub/AccountCategorySelect.client.tsx
"use client";

import { useState } from "react";
import { logger } from "@/lib/alphashield/logger";

interface Category {
  id: string;
  name: string;
}

interface AccountCategorySelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  showSeedButton?: boolean;
  onSeedSuccess?: () => void;
}

export default function AccountCategorySelect({
  value,
  onChange,
  categories,
  showSeedButton = false,
  onSeedSuccess,
}: AccountCategorySelectProps) {
  const [seedLoading, setSeedLoading] = useState(false);

  const handleSeed = async () => {
    try {
      setSeedLoading(true);
      const defaultCategories = [
        "Propfirm Forex",
        "Propfirm Futuros",
        "Forex Real",
        "Futuros Real",
        "Opciones",
      ];

      for (const catName of defaultCategories) {
        await fetch("/api/account-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catName }),
        });
      }

      onSeedSuccess?.();
    } catch (err: any) {
      await logger.error(
        "tradehub",
        "Error seeding categories",
        err instanceof Error ? err : undefined
      );
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div>
      <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
        Categoría *
      </label>

      {categories.length === 0 && showSeedButton ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: "0" }}>
            No hay categorías. Crea algunas primero.
          </p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seedLoading}
            style={{
              padding: "8px 12px",
              fontSize: "14px",
              backgroundColor: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: seedLoading ? "not-allowed" : "pointer",
              opacity: seedLoading ? 0.6 : 1,
            }}
          >
            {seedLoading ? "Creando..." : "Crear categorías sugeridas"}
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            boxSizing: "border-box",
          }}
        >
          <option value="">Selecciona una categoría...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
