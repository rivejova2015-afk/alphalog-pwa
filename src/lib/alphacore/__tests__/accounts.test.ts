// Unit tests for src/lib/alphacore/accounts.ts.
//
// Thin wrappers sobre createEntity/updateEntity/softDeleteEntity. Aseguramos
// que el wrapping correcto se hace (table='accounts', payload reenviado,
// options.optimistic, options.metadata.entityName='Account').
//
// Validates:
//   1. createAccountMutation: invoca createEntity('accounts', payload, ...).
//   2. createAccountMutation: options.optimistic=true.
//   3. createAccountMutation: metadata.entityName='Account', subsection='accounts'.
//   4. updateAccountMutation: invoca updateEntity('accounts', id, updates).
//   5. updateAccountMutation: options.optimistic=true.
//   6. deleteAccountMutation: invoca softDeleteEntity('accounts', id).
//   7. restoreAccountMutation: invoca updateEntity con { deleted_at: null }.
//   8. Wrapper retorna el resultado del helper inalterado.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { createEntityMock, updateEntityMock, softDeleteEntityMock } = vi.hoisted(() => ({
  createEntityMock:     vi.fn(),
  updateEntityMock:     vi.fn(),
  softDeleteEntityMock: vi.fn(),
}));

vi.mock("../mutations", () => ({
  createEntity:     createEntityMock,
  updateEntity:     updateEntityMock,
  softDeleteEntity: softDeleteEntityMock,
}));

import {
  createAccountMutation,
  updateAccountMutation,
  deleteAccountMutation,
  restoreAccountMutation,
} from "../accounts";

const SUCCESS_RESPONSE = (id = "a-1") => ({
  data: { id, name: "Account", category_id: "cat-1", withdrawals_enabled: true },
  mutationId: "m-1",
  status: "synced" as const,
});

describe("createAccountMutation", () => {
  beforeEach(() => {
    createEntityMock.mockReset();
    updateEntityMock.mockReset();
    softDeleteEntityMock.mockReset();
  });

  it("invoca createEntity con table='accounts' + payload", async () => {
    createEntityMock.mockResolvedValue(SUCCESS_RESPONSE());

    await createAccountMutation({
      name: "Funded $100k",
      category_id: "cat-funded",
      account_size: 100000,
    });

    expect(createEntityMock).toHaveBeenCalledTimes(1);
    expect(createEntityMock).toHaveBeenCalledWith(
      "accounts",
      expect.objectContaining({
        name: "Funded $100k",
        category_id: "cat-funded",
        account_size: 100000,
      }),
      expect.any(Object),
    );
  });

  it("options.optimistic=true + metadata.entityName='Account'", async () => {
    createEntityMock.mockResolvedValue(SUCCESS_RESPONSE());

    await createAccountMutation({ name: "x", category_id: "c" });

    const callArgs = createEntityMock.mock.calls[0];
    const options = callArgs[2] as Record<string, unknown>;
    expect(options.optimistic).toBe(true);
    expect((options.metadata as Record<string, unknown>).entityName).toBe("Account");
    expect((options.metadata as Record<string, unknown>).subsection).toBe("accounts");
  });

  it("Wrapper retorna el resultado de createEntity inalterado", async () => {
    const fakeResult = SUCCESS_RESPONSE("a-99");
    createEntityMock.mockResolvedValue(fakeResult);

    const result = await createAccountMutation({ name: "x", category_id: "c" });
    expect(result).toEqual(fakeResult);
  });

  it("Failure path: propaga el error del helper", async () => {
    createEntityMock.mockResolvedValue({
      error: { code: "UNAUTH", message: "no session" },
      mutationId: "m-2",
      status: "failed",
    });

    const result = await createAccountMutation({ name: "x", category_id: "c" });
    expect(result.error?.code).toBe("UNAUTH");
    // status is in the underlying MutationResponse from createEntity, but the
    // wrapper signature elides it — assert via cast.
    expect((result as unknown as { status: string }).status).toBe("failed");
  });
});

describe("updateAccountMutation", () => {
  beforeEach(() => {
    updateEntityMock.mockReset();
  });

  it("invoca updateEntity con table='accounts', id + updates", async () => {
    updateEntityMock.mockResolvedValue(SUCCESS_RESPONSE("a-1"));

    await updateAccountMutation("a-1", { name: "Renamed" });

    expect(updateEntityMock).toHaveBeenCalledWith(
      "accounts",
      "a-1",
      { name: "Renamed" },
      expect.objectContaining({ optimistic: true }),
    );
  });

  it("Wrapper retorna el resultado de updateEntity", async () => {
    const fakeResult = SUCCESS_RESPONSE("a-1");
    updateEntityMock.mockResolvedValue(fakeResult);

    const result = await updateAccountMutation("a-1", { name: "Updated" });
    expect(result).toEqual(fakeResult);
  });
});

describe("deleteAccountMutation", () => {
  beforeEach(() => {
    softDeleteEntityMock.mockReset();
  });

  it("invoca softDeleteEntity con table='accounts' + id", async () => {
    softDeleteEntityMock.mockResolvedValue(SUCCESS_RESPONSE("a-1"));

    await deleteAccountMutation("a-1");

    expect(softDeleteEntityMock).toHaveBeenCalledWith("accounts", "a-1");
  });

  it("Wrapper retorna el resultado de softDeleteEntity", async () => {
    const fakeResult = SUCCESS_RESPONSE("a-1");
    softDeleteEntityMock.mockResolvedValue(fakeResult);

    const result = await deleteAccountMutation("a-1");
    expect(result).toEqual(fakeResult);
  });
});

describe("restoreAccountMutation", () => {
  beforeEach(() => {
    updateEntityMock.mockReset();
  });

  it("invoca updateEntity con { deleted_at: null }", async () => {
    updateEntityMock.mockResolvedValue(SUCCESS_RESPONSE("a-1"));

    await restoreAccountMutation("a-1");

    expect(updateEntityMock).toHaveBeenCalledWith(
      "accounts",
      "a-1",
      { deleted_at: null },
      expect.objectContaining({ optimistic: true }),
    );
  });
});
