// Unit tests for src/lib/security/exportHardening.ts.
//
// Pure utils + Zod schemas para endpoints de export. Validates:
//   - EXPORT_CONFIG: límites de file size, records, rate limits, formats.
//   - validateDateRange: from > to error, range > 365 days error, missing OK.
//   - validateExportSize: rejects > 50MB.
//   - validateRecordCount: rejects > 100k.
//   - generateExportFilename: sanitiza, defaults a 'csv'.
//   - createAttachmentHeader: sanitiza + UTF-8 fallback.
//   - exportErrorResponse / exportSuccessResponse: shape correcto.
//   - exportMonthSchema/exportQuerySchema: Zod validation.
//   - logExportEvent: invokes auditLogger con shape correcto.

import { describe, it, expect, vi } from "vitest";
import {
  EXPORT_CONFIG,
  exportMonthSchema,
  exportQuerySchema,
  validateDateRange,
  validateExportSize,
  validateRecordCount,
  generateExportFilename,
  createAttachmentHeader,
  exportErrorResponse,
  exportSuccessResponse,
  logExportEvent,
} from "../exportHardening";

describe("EXPORT_CONFIG constants", () => {
  it("MAX_FILE_SIZE = 50MB, MAX_RECORDS = 100k, MAX_DAYS_RANGE = 365", () => {
    expect(EXPORT_CONFIG.MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    expect(EXPORT_CONFIG.MAX_RECORDS_PER_EXPORT).toBe(100_000);
    expect(EXPORT_CONFIG.MAX_DAYS_RANGE).toBe(365);
  });

  it("ALLOWED_FORMATS y ALLOWED_RESOURCES contienen valores esperados", () => {
    expect(EXPORT_CONFIG.ALLOWED_FORMATS).toContain("csv");
    expect(EXPORT_CONFIG.ALLOWED_FORMATS).toContain("json");
    expect(EXPORT_CONFIG.ALLOWED_FORMATS).toContain("pdf");
    expect(EXPORT_CONFIG.ALLOWED_RESOURCES).toContain("trades");
    expect(EXPORT_CONFIG.ALLOWED_RESOURCES).toContain("treasury");
  });
});

describe("validateDateRange", () => {
  it("valid=true cuando faltan dateFrom o dateTo (sin restricción)", () => {
    expect(validateDateRange(undefined, undefined).valid).toBe(true);
    expect(validateDateRange("2026-01-01", undefined).valid).toBe(true);
  });

  it("valid=false cuando from > to", () => {
    const r = validateDateRange("2026-06-01", "2026-05-01");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/date_from must be before date_to/);
  });

  it("valid=true cuando range <= 365 días", () => {
    expect(validateDateRange("2026-01-01", "2026-06-01").valid).toBe(true);
  });

  it("valid=false cuando range > 365 días", () => {
    const r = validateDateRange("2025-01-01", "2026-06-01");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/exceeds 365 days/);
  });

  it("valid=true en boundary exacto (365 días)", () => {
    expect(validateDateRange("2026-01-01", "2026-12-31").valid).toBe(true);
  });
});

describe("validateExportSize", () => {
  it("valid=true para size < 50MB", () => {
    expect(validateExportSize("small content").valid).toBe(true);
  });

  it("valid=false cuando content > 50MB", () => {
    const huge = "x".repeat(51 * 1024 * 1024);
    const r = validateExportSize(huge);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/exceeds maximum size of 50MB/);
  });

  it("sizeMB calculado correctamente", () => {
    const oneMb = "x".repeat(1024 * 1024);
    expect(validateExportSize(oneMb).sizeMB).toBeCloseTo(1, 1);
  });
});

describe("validateRecordCount", () => {
  it("valid=true para count <= 100k", () => {
    expect(validateRecordCount(Array(50_000).fill({})).valid).toBe(true);
    expect(validateRecordCount(Array(100_000).fill({})).valid).toBe(true);
  });

  it("valid=false cuando count > 100k", () => {
    const r = validateRecordCount(Array(100_001).fill({}));
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/exceeds limit of 100000/);
  });
});

describe("generateExportFilename", () => {
  it("formato: '<resource>-export-<dateOrTimestamp>.<ext>'", () => {
    const name = generateExportFilename("trades", "csv", "2026-06");
    expect(name).toMatch(/^trades-export-2026-06\.csv$/);
  });

  it("sanitiza caracteres no-alphanumeric en resourceType + dateStr", () => {
    const name = generateExportFilename("trades../etc", "csv", "../../passwd");
    expect(name).not.toContain("..");
    expect(name).not.toContain("/");
  });

  it("default ext='csv' para format no-json/pdf", () => {
    expect(generateExportFilename("x", "csv")).toMatch(/\.csv$/);
    expect(generateExportFilename("x", "unknown")).toMatch(/\.csv$/);
  });

  it("ext='json' / 'pdf' cuando se pasa", () => {
    expect(generateExportFilename("x", "json", "2026")).toMatch(/\.json$/);
    expect(generateExportFilename("x", "pdf", "2026")).toMatch(/\.pdf$/);
  });

  it("Sin dateStr → usa ISO timestamp en el filename", () => {
    const name = generateExportFilename("trades", "csv");
    expect(name).toMatch(/^trades-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
  });
});

describe("createAttachmentHeader", () => {
  it("incluye filename y filename* con UTF-8 encoding", () => {
    const h = createAttachmentHeader("safe-file.csv");
    expect(h).toMatch(/attachment; filename="safe-file\.csv"/);
    expect(h).toMatch(/filename\*=UTF-8''safe-file\.csv/);
  });

  it("sanitiza caracteres especiales (security: prevent injection)", () => {
    const h = createAttachmentHeader('xss"; injection=true');
    expect(h).not.toContain('"; injection=true');
  });
});

describe("exportErrorResponse / exportSuccessResponse", () => {
  it("exportErrorResponse retorna Response status default 400", async () => {
    const res = exportErrorResponse("Bad request");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(await res.text()).toBe("Bad request");
  });

  it("exportErrorResponse acepta statusCode custom", () => {
    expect(exportErrorResponse("rate limit", 429).status).toBe(429);
  });

  it("exportSuccessResponse retorna Response con Content-Disposition + nosniff + DENY", () => {
    const res = exportSuccessResponse("a,b,c", "csv", "trades.csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
    expect(res.headers.get("Content-Disposition")).toMatch(/trades\.csv/);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("exportSuccessResponse mime types por format", () => {
    expect(exportSuccessResponse("{}", "json", "x.json").headers.get("Content-Type")).toMatch(/application\/json/);
    expect(exportSuccessResponse("", "pdf", "x.pdf").headers.get("Content-Type")).toBe("application/pdf");
  });
});

describe("Zod schemas", () => {
  it("exportMonthSchema acepta 'YYYY-MM'", () => {
    expect(exportMonthSchema.safeParse({ month: "2026-06" }).success).toBe(true);
  });

  it("exportMonthSchema rechaza '2026/06' o 'June 2026'", () => {
    expect(exportMonthSchema.safeParse({ month: "2026/06" }).success).toBe(false);
    expect(exportMonthSchema.safeParse({ month: "June 2026" }).success).toBe(false);
  });

  it("exportQuerySchema requiere resource_type + format de la lista", () => {
    expect(exportQuerySchema.safeParse({ resource_type: "trades", format: "csv" }).success).toBe(true);
    expect(exportQuerySchema.safeParse({ resource_type: "trades", format: "xlsx" }).success).toBe(false);
    expect(exportQuerySchema.safeParse({ resource_type: "unknown", format: "csv" }).success).toBe(false);
  });
});

describe("logExportEvent", () => {
  it("invokes auditLogger con shape correcto", async () => {
    const auditLogger = vi.fn().mockResolvedValue("audit-1");
    await logExportEvent({
      userId:       "u1",
      resourceType: "trades",
      format:       "csv",
      recordCount:  500,
      fileSizeMB:   1.5,
      dateFrom:     "2026-01-01",
      dateTo:       "2026-06-30",
      ipHint:       "1.2.3.4",
      status:       "success",
    }, auditLogger);

    expect(auditLogger).toHaveBeenCalledTimes(1);
    expect(auditLogger.mock.calls[0][0]).toMatchObject({
      userId:       "u1",
      action:       "export",
      resourceType: "export",
      status:       "success",
    });
    expect(auditLogger.mock.calls[0][0].changes).toMatchObject({
      resourceType: "trades",
      format:       "csv",
      dateRange:    "2026-01-01 to 2026-06-30",
    });
  });

  it("status='blocked' → audit status='failure' (no-success path)", async () => {
    const auditLogger = vi.fn().mockResolvedValue(null);
    await logExportEvent({
      userId: "u1", resourceType: "trades", format: "csv",
      status: "blocked", reason: "Rate limited",
    }, auditLogger);
    expect(auditLogger.mock.calls[0][0].status).toBe("failure");
    expect(auditLogger.mock.calls[0][0].errorMessage).toBe("Rate limited");
  });

  it("auditLogger=null → no-op (silent skip)", async () => {
    await expect(logExportEvent({
      userId: "u1", resourceType: "trades", format: "csv", status: "success",
    }, null)).resolves.toBeUndefined();
  });

  it("auditLogger reject no propaga (catch)", async () => {
    const auditLogger = vi.fn().mockRejectedValue(new Error("audit boom"));
    await expect(logExportEvent({
      userId: "u1", resourceType: "trades", format: "csv", status: "success",
    }, auditLogger)).resolves.toBeUndefined();
  });
});
