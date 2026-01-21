// src/components/logs/SeedCategoriesButton.client.tsx
"use client";

import { useState } from "react";
import { logError } from "@/lib/log";

interface SeedCategoriesButtonProps {
  onSuccess?: () => void;
}

const SEED_CATEGORIES = [
  "Propfirm Forex",
  "Propfirm Futuros",
  "Forex Real",
  "Futuros Real",
  "Opciones",
];

export default function SeedCategoriesButton({
  onSuccess,
}: SeedCategoriesButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  const handleSeed = async (retry = false) => {
    try {
      if (!retry) {
        setLoading(true);
      } else {
        setRetrying(true);
      }
      setError("");

      const results = [];

      for (const categoryName of SEED_CATEGORIES) {
        try {
          const response = await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: categoryName }),
          });

          if (!response.ok) {
            // 409 significa duplicado (constraint única), es OK
            if (response.status === 409) {
              results.push({ ok: true, name: categoryName, status: 409 });
              continue;
            }

            // Otro error: intenta leer el mensaje
            let errorMsg = `HTTP ${response.status}`;
            try {
              const data = await response.json();
              if (data.error) {
                errorMsg = data.error;
              }
            } catch {}

            results.push({ ok: false, name: categoryName, error: errorMsg });
          } else {
            results.push({ ok: true, name: categoryName, status: 200 });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          results.push({ ok: false, name: categoryName, error: msg });
        }
      }

      // Verifica si alguno falló (excepto 409)
      const hasFailed = results.some((r) => !r.ok);

      if (hasFailed) {
        const failedNames = results
          .filter((r) => !r.ok)
          .map((r) => `${r.name}: ${r.error}`)
          .join(", ");

        setError(
          `Error al crear algunas categorías. ${failedNames}. Intenta de nuevo.`
        );

        logError("SeedCategoriesButton", {
          component: "SeedCategoriesButton",
          action: "seed categories",
          endpoint: "/api/categories",
          message: `Some categories failed to seed: ${failedNames}`,
        });

        return;
      }

      // Éxito
      setError("");
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error inesperado: ${msg}. Intenta de nuevo.`);

      logError("SeedCategoriesButton", {
        component: "SeedCategoriesButton",
        action: "seed categories",
        endpoint: "/api/categories",
        message: msg,
      });
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  const isDisabled = loading || retrying;

  return (
    <div className="space-y-2">
      <button
        onClick={() => handleSeed(false)}
        disabled={isDisabled}
        style={{
          padding: "8px 16px",
          fontSize: "14px",
          backgroundColor: isDisabled ? "#6b7280" : "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.6 : 1,
          fontWeight: "500",
        }}
      >
        {loading
          ? "Creando..."
          : retrying
            ? "Reintentando..."
            : "Crear categorías sugeridas"}
      </button>

      {error && (
        <div style={{ marginTop: "8px" }}>
          <p style={{ fontSize: "12px", color: "#dc2626", marginBottom: "6px" }}>
            ⚠️ {error}
          </p>
          {error.includes("Intenta de nuevo") && (
            <button
              onClick={() => handleSeed(true)}
              disabled={isDisabled}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                backgroundColor: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.6 : 1,
              }}
            >
              🔄 Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
