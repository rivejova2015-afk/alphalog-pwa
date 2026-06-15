// @vitest-environment jsdom
//
// createJournalEntry + updateJournalEntry — wrappers de mutateOfflineFirst
// con pre-validation y pre-submit dedupe check.
//
// Validates:
//   1. createJournalEntry: VALIDATION_ERROR cuando text vacío.
//   2. createJournalEntry: VALIDATION_ERROR cuando mood_score fuera de rango.
//   3. createJournalEntry: DUPLICATE_ENTRY cuando dedupe retorna isDuplicate
//      + confidence='certain'.
//   4. createJournalEntry: success path con mutateOfflineFirst returning data.
//   5. createJournalEntry: catch path con mutateOfflineFirst throw → MUTATION_ERROR.
//   6. updateJournalEntry: INVALID_INPUT cuando id falta.
//   7. updateJournalEntry: VALIDATION_ERROR cuando input invalido.
//   8. updateJournalEntry: success path con mutateOfflineFirst.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mutateMock, dedupeMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  dedupeMock: vi.fn(),
}));

vi.mock("@/lib/alphacore/offline/offlineBridge", () => ({
  mutateOfflineFirst: mutateMock,
  getOfflineBridge: vi.fn(),
}));
vi.mock("@/lib/alphacore/dedupe-checker", () => ({
  preSubmitDedupeCheck: dedupeMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

import { createJournalEntry, updateJournalEntry } from "../journal";

const USER_ID = "u-1";

function validInput() {
  return {
    text: "Today I traded XAUUSD with discipline and patience.",
    mood: "good" as const,
    mood_score: 7,
    tags: ["xauusd", "discipline"],
  };
}

describe("createJournalEntry", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    dedupeMock.mockReset();
    dedupeMock.mockResolvedValue({ isDuplicate: false });
  });

  it("VALIDATION_ERROR cuando text vacío", async () => {
    const result = await createJournalEntry({ text: "" }, USER_ID);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.message).toContain("Journal entry text is required");
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR cuando mood_score = 0 (fuera de rango)", async () => {
    const result = await createJournalEntry({
      text: "Valid text here", mood_score: 0,
    }, USER_ID);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.message).toContain("Mood score must be between 1 and 10");
  });

  it("DUPLICATE_ENTRY cuando dedupe.isDuplicate + confidence='certain'", async () => {
    dedupeMock.mockResolvedValue({ isDuplicate: true, confidence: "certain" });

    const result = await createJournalEntry(validInput(), USER_ID);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("DUPLICATE_ENTRY");
    expect(result.error?.message).toContain("already exists");
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("NO duplicate cuando confidence != 'certain' → procede a mutateOfflineFirst", async () => {
    dedupeMock.mockResolvedValue({ isDuplicate: true, confidence: "low" });
    mutateMock.mockResolvedValue({
      data: { id: "j-1", user_id: USER_ID }, error: undefined, status: "synced",
    });

    const result = await createJournalEntry(validInput(), USER_ID);
    expect(result.status).toBe("synced");
    expect(mutateMock).toHaveBeenCalled();
  });

  it("Success path: mutateOfflineFirst returns data → returns synced", async () => {
    mutateMock.mockResolvedValue({
      data: { id: "j-1", user_id: USER_ID, text: validInput().text },
      error: undefined,
      status: "synced",
    });

    const result = await createJournalEntry(validInput(), USER_ID);
    expect(result.status).toBe("synced");
    expect(result.data?.id).toBe("j-1");
    expect(result.mutationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("Catch path: mutateOfflineFirst throws → MUTATION_ERROR", async () => {
    mutateMock.mockRejectedValue(new Error("idb write failed"));

    const result = await createJournalEntry(validInput(), USER_ID);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("MUTATION_ERROR");
    expect(result.error?.message).toBe("idb write failed");
  });

  it("mutateOfflineFirst llamado con 'journal_entries' table + 'create' op", async () => {
    mutateMock.mockResolvedValue({ data: { id: "j-1" }, status: "synced" });
    await createJournalEntry(validInput(), USER_ID);

    expect(mutateMock).toHaveBeenCalledWith(
      "journal_entries",
      "create",
      expect.objectContaining({
        user_id: USER_ID,
        text: validInput().text,
        mood: "good",
        mood_score: 7,
      }),
      expect.any(Object),
    );
  });
});

describe("updateJournalEntry", () => {
  beforeEach(() => {
    mutateMock.mockReset();
  });

  it("INVALID_INPUT cuando id falta", async () => {
    const result = await updateJournalEntry({
      id: "", text: "Valid update content here",
    }, USER_ID);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("INVALID_INPUT");
    expect(result.error?.message).toBe("Journal entry ID is required");
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR cuando text vacío en update", async () => {
    const result = await updateJournalEntry({
      id: "j-1", text: "",
    }, USER_ID);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.message).toContain("Journal entry text is required");
  });

  it("Success path: mutateOfflineFirst returns data", async () => {
    mutateMock.mockResolvedValue({
      data: { id: "j-1", text: "Updated text content for the entry" },
      error: undefined,
      status: "synced",
    });

    const result = await updateJournalEntry({
      id: "j-1", text: "Updated text content for the entry",
    }, USER_ID);
    expect(result.status).toBe("synced");
    expect(result.data?.id).toBe("j-1");
  });

  it("Catch path: mutateOfflineFirst throws → MUTATION_ERROR", async () => {
    mutateMock.mockRejectedValue(new Error("server 503"));

    const result = await updateJournalEntry({
      id: "j-1", text: "Updated text content for the entry",
    }, USER_ID);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("MUTATION_ERROR");
  });

  it("mutateOfflineFirst llamado con 'update' op + user_id + timestamps", async () => {
    mutateMock.mockResolvedValue({ data: {}, status: "synced" });
    await updateJournalEntry({
      id: "j-1", text: "Updated content for the entry",
    }, USER_ID);

    expect(mutateMock).toHaveBeenCalledWith(
      "journal_entries",
      "update",
      expect.objectContaining({
        id: "j-1",
        user_id: USER_ID,
        updated_at: expect.any(String),
        edited_at: expect.any(String),
      }),
      expect.any(Object),
    );
  });
});
