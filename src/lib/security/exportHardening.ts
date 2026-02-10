// src/lib/security/exportHardening.ts
import { z } from "zod";
import { type AuditLogEntry } from "./auditLog";

/**
 * Export hardening utilities
 * Protects export endpoints against abuse, data leaks, and injection attacks
 */

// Configuration
export const EXPORT_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_RECORDS_PER_EXPORT: 100000, // 100k rows max
  RATE_LIMIT_PER_HOUR: 20, // 20 exports per hour per user
  RATE_LIMIT_PER_MINUTE: 3, // 3 exports per minute per user
  ALLOWED_FORMATS: ["csv", "json", "pdf"] as const,
  ALLOWED_RESOURCES: ["trades", "journal", "accounts", "setups", "all", "treasury"] as const,
  MAX_DAYS_RANGE: 365, // Cannot export more than 1 year at once
};

// Validation schemas
export const exportMonthSchema = z.object({
  month: z.string()
    .regex(/^\d{4}-\d{2}$/, { message: "month must be YYYY-MM format" }),
});

export const exportQuerySchema = z.object({
  resource_type: z.enum(EXPORT_CONFIG.ALLOWED_RESOURCES),
  format: z.enum(EXPORT_CONFIG.ALLOWED_FORMATS),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  include_deleted: z.boolean().optional(),
});

/**
 * Validate date range to prevent excessive data pulls
 */
export function validateDateRange(dateFrom?: string, dateTo?: string): { valid: boolean; error?: string } {
  if (!dateFrom || !dateTo) {
    return { valid: true };
  }

  try {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (from > to) {
      return { valid: false, error: "date_from must be before date_to" };
    }

    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > EXPORT_CONFIG.MAX_DAYS_RANGE) {
      return {
        valid: false,
        error: `Date range exceeds ${EXPORT_CONFIG.MAX_DAYS_RANGE} days`,
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid date format" };
  }
}

/**
 * Validate file size before returning export
 */
export function validateExportSize(content: string): { valid: boolean; error?: string; sizeMB: number } {
  const bytes = new TextEncoder().encode(content).length;
  const mb = bytes / (1024 * 1024);

  if (bytes > EXPORT_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Export exceeds maximum size of ${EXPORT_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      sizeMB: mb,
    };
  }

  return { valid: true, sizeMB: mb };
}

/**
 * Validate row count to prevent excessive processing
 */
export function validateRecordCount(records: unknown[]): { valid: boolean; error?: string } {
  if (records.length > EXPORT_CONFIG.MAX_RECORDS_PER_EXPORT) {
    return {
      valid: false,
      error: `Export contains ${records.length} records, exceeds limit of ${EXPORT_CONFIG.MAX_RECORDS_PER_EXPORT}`,
    };
  }

  return { valid: true };
}

/**
 * Generate safe filename for export download
 */
export function generateExportFilename(resourceType: string, format: string, dateStr?: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const safeResourceType = resourceType.replace(/[^a-z0-9-]/gi, "");
  const safeDateStr = dateStr?.replace(/[^a-z0-9-]/gi, "") || "";
  const fileExt = format === "json" ? "json" : format === "pdf" ? "pdf" : "csv";

  return `${safeResourceType}-export-${safeDateStr || timestamp}.${fileExt}`;
}

/**
 * Create sanitized filename header value
 */
export function createAttachmentHeader(filename: string): string {
  // Sanitize filename to prevent injection
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

/**
 * Log export event for audit trail
 */
export interface ExportLog {
  userId: string;
  resourceType: string;
  format: string;
  recordCount?: number;
  fileSizeMB?: number;
  dateFrom?: string;
  dateTo?: string;
  ipHint?: string;
  status: "success" | "blocked" | "failed";
  reason?: string;
}

export async function logExportEvent(
  entry: ExportLog,
  auditLogger: ((entry: AuditLogEntry) => Promise<string | null>) | null
): Promise<void> {
  if (!auditLogger) return;

  auditLogger({
    userId: entry.userId,
    action: "export" as const,
    resourceType: "export" as const,
    changes: {
      resourceType: entry.resourceType,
      format: entry.format,
      recordCount: entry.recordCount,
      fileSizeMB: entry.fileSizeMB,
      dateRange: entry.dateFrom && entry.dateTo ? `${entry.dateFrom} to ${entry.dateTo}` : "all",
    },
    status: entry.status === "success" ? "success" : entry.status === "blocked" ? "failure" : "failure",
    errorMessage: entry.reason,
    ipHint: entry.ipHint,
  }).catch(e => console.warn("[Audit] Failed to log export:", e));
}

/**
 * Helper to create export error response with status code
 */
export function exportErrorResponse(message: string, statusCode: number = 400) {
  return new Response(message, {
    status: statusCode,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

/**
 * Helper to create export success response
 */
export function exportSuccessResponse(
  content: string,
  format: "csv" | "json" | "pdf",
  filename: string
): Response {
  const mimeTypes: Record<string, string> = {
    csv: "text/csv;charset=utf-8",
    json: "application/json;charset=utf-8",
    pdf: "application/pdf",
  };

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": mimeTypes[format],
      "Content-Disposition": createAttachmentHeader(filename),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
