// src/components/logs/LogEditor.client.tsx
"use client";

import { useState, useEffect } from "react";
import CategorySelect from "./CategorySelect.client";
import TagsInput from "./TagsInput.client";
import AttachmentsUploader from "./AttachmentsUploader.client";
import AttachmentsList from "./AttachmentsList.client";

interface Log {
  id: string;
  title: string;
  notes: string;
  type: string | null;
  category_id: string;
  log_tags?: Array<{ tags: { name: string } }>;
}

interface LogEditorProps {
  log?: Log;
  onSave: (data: {
    id?: string;
    title: string;
    notes: string;
    categoryId: string;
    type: string;
    tagNames: string[];
  }) => Promise<void>;
  onClose: () => void;
}

export default function LogEditor({ log, onSave, onClose }: LogEditorProps) {
  const [title, setTitle] = useState(log?.title || "");
  const [notes, setNotes] = useState(log?.notes || "");
  const [categoryId, setCategoryId] = useState(log?.category_id || "");
  const [type, setType] = useState(log?.type || "");
  const [tags, setTags] = useState<string[]>(
    log?.log_tags?.map((lt) => lt.tags.name) || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachmentRefresh, setAttachmentRefresh] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !notes.trim() || !categoryId) {
      setError("Por favor completa todos los campos obligatorios");
      return;
    }

    if (tags.length > 25) {
      setError("Máximo 25 tags permitidos");
      return;
    }

    try {
      setLoading(true);
      await onSave({
        ...(log && { id: log.id }),
        title: title.trim(),
        notes: notes.trim(),
        categoryId,
        type: type.trim(),
        tagNames: tags,
      });
      onClose();
    } catch (err: any) {
      console.error("Error saving log:", err);
      if (err.message?.includes("already_exists")) {
        setError(
          "Ya existe un log con ese título hoy (UTC). Cambia el título o edita el existente."
        );
      } else {
        setError("Error al guardar el log. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "700",
            color: "#1f2937",
            margin: "0 0 16px 0",
          }}
        >
          {log ? "Editar Log" : "Nuevo Log"}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                borderRadius: "4px",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="Título del log"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Notas *
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              placeholder="Escribe tus notas aquí..."
              rows={5}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontFamily: "system-ui, sans-serif",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937", display: "block", marginBottom: "6px" }}>
              Tipo
            </label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={loading}
              placeholder="Ej: Trading, Personal, Research"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Category */}
          <CategorySelect
            value={categoryId}
            onChange={setCategoryId}
          />

          {/* Tags */}
          <TagsInput value={tags} onChange={setTags} />

          {/* Attachments - Only show for existing logs */}
          {log && (
            <>
              <AttachmentsUploader
                logId={log.id}
                onUploadSuccess={() => setAttachmentRefresh((prev) => prev + 1)}
              />
              <AttachmentsList logId={log.id} refreshTrigger={attachmentRefresh} />
            </>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: "#e5e7eb",
                color: "#1f2937",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Guardando..." : log ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
