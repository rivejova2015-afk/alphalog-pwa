import { z } from "zod";

type ContractResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string> };

export function enforceResponseContract<T>(schema: z.ZodSchema<T>, payload: unknown): ContractResult<T> {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      errors[path || "root"] = issue.message;
    });
    return { ok: false, errors };
  }

  return { ok: true, data: result.data };
}
