// src/components/logs/AttachmentsUploader.client.tsx
"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";

interface AttachmentsUploaderProps {
  logId: string;
  onUploadSuccess?: () => void;
}

const MAX_FILE_MB = 100;
const BLOCKED_EXTENSIONS = [".exe", ".bat"];
const BUCKET_NAME = "log_attachments";

export default function AttachmentsUploader({
  logId,
  onUploadSuccess,
}: AttachmentsUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});

  const validateFile = (file: File): string | null => {
    // Check file size
    const fileSizeMb = file.size / (1024 * 1024);
    if (fileSizeMb > MAX_FILE_MB) {
      return `El archivo "${file.name}" excede ${MAX_FILE_MB}MB (${fileSizeMb.toFixed(1)}MB)`;
    }

    // Check blocked extensions
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(extension)) {
      return `El archivo "${file.name}" no está permitido (extensión: ${extension})`;
    }

    return null;
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    setError("");
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setError("No autenticado. Recarga la página.");
      return;
    }

    const userId = userData.user.id;
    const fileArray = Array.from(files);
    const validationErrors: string[] = [];

    // Validate all files first
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        validationErrors.push(validationError);
      }
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join("\n"));
      fileInputRef.current!.value = "";
      return;
    }

    try {
      setUploading(true);
      const filesToUpload = fileArray.filter((f) => !validateFile(f));

      for (const file of filesToUpload) {
        const fileId = `${file.name}-${Date.now()}`;
        setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

        // Generate unique path
        const randomId = crypto.randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${logId}/${randomId}_${safeName}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(path, file, { upsert: false });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          setError(`Error al subir "${file.name}": ${uploadError.message}`);
          setUploadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
          continue;
        }

        // Create metadata in database
        const metadataResponse = await fetch("/api/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logId,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            path,
          }),
        });

        if (!metadataResponse.ok) {
          const errorData = await metadataResponse.json();
          console.error("Metadata creation error:", errorData);
          setError(`Error al guardar metadatos de "${file.name}"`);
          continue;
        }

        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }

      // Reset input
      fileInputRef.current!.value = "";

      // Notify parent to refresh
      onUploadSuccess?.();
    } catch (err: any) {
      console.error("Error uploading file:", err);
      setError(`Error: ${err.message || "No se pudo subir el archivo"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label
        style={{
          fontSize: "14px",
          fontWeight: "500",
          color: "#1f2937",
          display: "block",
          marginBottom: "6px",
        }}
      >
        📎 Adjuntos (máx {MAX_FILE_MB}MB c/u)
      </label>

      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "4px",
            fontSize: "13px",
            marginBottom: "8px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px",
          backgroundColor: "#f3f4f6",
          border: "2px dashed #d1d5db",
          borderRadius: "4px",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={uploading}
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <span style={{ fontSize: "20px" }}>📤</span>
        <span style={{ fontSize: "14px", color: "#6b7280" }}>
          {uploading ? "Subiendo..." : "Haz clic o arrastra archivos"}
        </span>
      </div>

      {Object.keys(uploadProgress).length > 0 && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
          Subiendo {Object.keys(uploadProgress).length} archivo(s)...
        </div>
      )}
    </div>
  );
}
