// src/components/terminal/EvidenceAttachments.client.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

const BLOCKED_EXTENSIONS = [".exe", ".bat"];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface Props {
  reportId: string;
}

export default function EvidenceAttachments({ reportId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");

  // Define fetchAttachments with useCallback first
  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/terminal/evidence/${reportId}/attachments`
      );
      const data = await response.json();
      setAttachments(data);
    } catch (err) {
      console.error("Error fetching attachments:", err);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  // Then use it in the effect
  useEffect(() => {
    void fetchAttachments();
  }, [fetchAttachments]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    setError("");
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Check size
        if (file.size > MAX_FILE_SIZE) {
          setError(`Archivo ${file.name} excede 100MB`);
          continue;
        }

        // Check extension
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (BLOCKED_EXTENSIONS.includes(ext)) {
          setError(`Extensión ${ext} no permitida`);
          continue;
        }

        // Upload
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `/api/terminal/evidence/${reportId}/attachments`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Error al cargar archivo");
        }
      }

      // Reset input
      e.currentTarget.value = "";
      await fetchAttachments();
    } catch (err) {
      console.error("Error:", err);
      setError("Error al cargar archivos");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("¿Estás seguro de eliminar este archivo?")) {
      return;
    }

    try {
      await fetch(
        `/api/terminal/evidence/${reportId}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      await fetchAttachments();
    } catch (err) {
      console.error("Error deleting attachment:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith("image/");
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">📎 Adjuntos</h3>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-slate-500 transition cursor-pointer">
        <label className="block cursor-pointer">
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv"
          />
          <div className="space-y-2">
            <p className="text-4xl">📤</p>
            <p className="text-white font-medium">
              {uploading ? "Cargando..." : "Arrastra archivos aquí"}
            </p>
            <p className="text-sm text-gray-400">
              o haz clic para seleccionar (máx 100MB por archivo)
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Bloqueados: .exe, .bat
            </p>
          </div>
        </label>
      </div>

      {loading ? (
        <div className="text-gray-400">Cargando adjuntos...</div>
      ) : attachments.length === 0 ? (
        <div className="text-gray-400">Sin adjuntos aún</div>
      ) : (
        <div className="space-y-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="bg-slate-700 p-4 rounded border border-slate-600 space-y-2"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-white break-all">
                    {att.filename}
                  </p>
                  <p className="text-sm text-gray-400">
                    {formatFileSize(att.size_bytes)} • {att.mime_type}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(att.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(att.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm whitespace-nowrap"
                >
                  Borrar
                </button>
              </div>

              {/* Image Preview */}
              {isImageFile(att.mime_type) && (
                <div className="mt-2">
                  <Image
                    src={`/api/terminal/evidence/${reportId}/attachments/${att.id}/signed-url`}
                    alt={att.filename}
                    width={512}
                    height={256}
                    className="max-h-64 rounded border border-slate-500 object-contain"
                    unoptimized
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
