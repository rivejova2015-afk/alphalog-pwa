// src/components/logs/AttachmentsList.client.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";
import Image from "next/image";

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  signedUrl: string | null;
  path: string;
}

interface AttachmentsListProps {
  logId: string;
  refreshTrigger?: number;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function AttachmentsList({
  logId,
  refreshTrigger,
}: AttachmentsListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/attachments?logId=${logId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch attachments");
      }

      const data: Attachment[] = await response.json();
      setAttachments(data || []);
    } catch (err: any) {
      console.error("Error fetching attachments:", err);
      setError("Error al cargar adjuntos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [logId, refreshTrigger]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const isImage = (mimeType: string): boolean => {
    return IMAGE_TYPES.includes(mimeType);
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      setDeleting(true);

      const response = await fetch(`/api/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete attachment");
      }

      // Update local state
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      setDeleteConfirm(null);
      setError("");
    } catch (err: any) {
      console.error("Error deleting attachment:", err);
      setError("Error al eliminar adjunto. Intenta de nuevo.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ fontSize: "14px", color: "#6b7280" }}>
        Cargando adjuntos...
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (attachments.length === 0) {
    return (
      <div style={{ fontSize: "13px", color: "#9ca3af" }}>
        Sin adjuntos
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gap: "8px",
        }}
      >
        {attachments.map((att) => (
          <div
            key={att.id}
            style={{
              padding: "12px",
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {isImage(att.mimeType) && att.signedUrl ? (
                <div>
                  <a
                    href={att.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#3b82f6",
                      textDecoration: "none",
                      wordBreak: "break-word",
                    }}
                  >
                    🖼️ {att.filename}
                  </a>
                  <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                    <Image
                      src={att.signedUrl}
                      alt={att.filename}
                      width={300}
                      height={150}
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        borderRadius: "4px",
                        marginTop: "4px",
                      }}
                      unoptimized
                    />
                  </div>
                </div>
              ) : att.signedUrl ? (
                <a
                  href={att.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#3b82f6",
                    textDecoration: "none",
                    wordBreak: "break-word",
                  }}
                >
                  📎 {att.filename}
                </a>
              ) : (
                <span style={{ wordBreak: "break-word" }}>
                  📎 {att.filename}
                </span>
              )}
              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                {formatFileSize(att.sizeBytes)}
              </div>
            </div>

            {deleteConfirm === att.id ? (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => handleDelete(att.id)}
                  disabled={deleting}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    backgroundColor: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: "3px",
                    cursor: deleting ? "not-allowed" : "pointer",
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? "..." : "Confirmar"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    backgroundColor: "#e5e7eb",
                    color: "#1f2937",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(att.id)}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
