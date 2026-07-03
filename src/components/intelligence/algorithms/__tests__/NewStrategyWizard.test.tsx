// @vitest-environment jsdom
//
// Integration test for the NewStrategyWizard container itself (Wave 4 item
// 19 — a 1150+ line component with zero direct test coverage; only an
// exported sub-piece, StepLatencyArbPairing, had tests). Covers:
//   - Market type chips: forex is the default; switching renders the right
//     Step component (StepForex / StepFutures / StepCrypto).
//   - 'options' no longer appears as a selectable chip (Wave 4 item 16).
//   - Step navigation (Siguiente/Anterior), disabled when name is empty.
//   - handleCreate validation: empty name / empty instruments block creation.
//   - Happy path: forex creation inserts the expected `algorithms` row shape.
//   - Happy path: crypto creation — market_type='crypto', platform='fly',
//     direction='both', linked_bot_account_id=null (Wave 4 item 14).
//   - Cancel closes the modal without inserting anything.
//
// Heavy/self-fetching children (AlgorithmWizardStep2, InstrumentMultiSelect)
// are stubbed — this file tests the wizard's own orchestration, not their
// internals (neither has its own test file yet either, but that's a
// separate, smaller surface than the container itself).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewStrategyWizard } from "../NewStrategyWizard.client";

const { getUserMock, insertMock, refreshMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  getUserMock:    vi.fn(),
  insertMock:     vi.fn(),
  refreshMock:    vi.fn(),
  toastErrorMock:   vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

vi.mock("../InstrumentMultiSelect.client", () => ({
  InstrumentMultiSelect: ({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) => (
    <div>
      <input
        aria-label="instruments"
        value={value.join(",")}
        onChange={(e) => onChange(e.target.value ? e.target.value.split(",") : [])}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

vi.mock("../AlgorithmWizardStep2.client", () => ({
  AlgorithmWizardStep2: () => <div data-testid="step2-stub">Step 2 stub</div>,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const chainable = ["select", "eq", "is", "order"];
      for (const m of chainable) chain[m] = () => chain;
      chain.insert = (payload: unknown) => { insertMock(table, payload); return chain; };
      chain.single = () =>
        Promise.resolve(table === "algorithms" ? { data: { id: "new-algo-1" }, error: null } : { data: null, error: null });
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
      return chain;
    },
  }),
}));

function renderWizard(onClose = vi.fn()) {
  render(<NewStrategyWizard onClose={onClose} />);
  return onClose;
}

async function fillName(text: string) {
  const nameInput = await screen.findByPlaceholderText(/Gold Arb v1|Coinarb research v2/);
  fireEvent.change(nameInput, { target: { value: text } });
}

describe("NewStrategyWizard", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockReset();
    refreshMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("defaults to forex and renders StepForex", async () => {
    renderWizard();
    expect(await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i)).toBeDefined();
  });

  it("'options' is not offered as a market type chip (Wave 4 item 16)", async () => {
    renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    expect(screen.queryByText(/Options IBKR/i)).toBeNull();
  });

  it("switching to Futures CME renders StepFutures", async () => {
    renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    fireEvent.click(screen.getByText("Futures CME"));
    expect(await screen.findByText(/Contrato/i)).toBeDefined();
  });

  it("switching to Crypto renders StepCrypto (Wave 4 item 14)", async () => {
    renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    fireEvent.click(screen.getByText(/Crypto \(Coinbase\)/i));
    expect(await screen.findByText(/Coinbase spot vía Fly\.io/i)).toBeDefined();
    expect(screen.getByText(/Fly\.io \(Coinbase spot\)/i)).toBeDefined();
  });

  it("'Siguiente' is disabled until a name is entered, then advances to Step 2", async () => {
    renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    const nextBtn = screen.getByRole("button", { name: /Siguiente/i });
    expect(nextBtn).toBeDisabled();

    await fillName("My Gold Bot");
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(await screen.findByTestId("step2-stub")).toBeDefined();
  });

  it("clicking Cancelar on step 1 calls onClose without inserting", async () => {
    const onClose = renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("handleCreate blocks and jumps to step 0 when instruments are empty", async () => {
    renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    await fillName("No Instruments Bot");

    // Clear the (stubbed) instrument field.
    const instrumentsInput = screen.getByLabelText("instruments");
    fireEvent.change(instrumentsInput, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByTestId("step2-stub");

    fireEvent.click(screen.getByRole("button", { name: /Crear estrategia/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Selecciona al menos un instrumento");
    });
    expect(insertMock).not.toHaveBeenCalled();
    // Back on step 1 — the forex info banner is visible again.
    expect(await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i)).toBeDefined();
  });

  it("happy path: forex creation inserts the expected algorithms row and closes", async () => {
    const onClose = renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    await fillName("Gold Scalper");

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByTestId("step2-stub");

    fireEvent.click(screen.getByRole("button", { name: /Crear estrategia/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
    const [table, payload] = insertMock.mock.calls[0];
    expect(table).toBe("algorithms");
    expect(payload).toMatchObject({
      name: "Gold Scalper",
      market_type: "forex",
      platform: "MT5",
      status: "paused",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("happy path: crypto creation is research-mode (no linked bot, direction=both, platform=fly)", async () => {
    renderWizard();
    await screen.findByText(/Estrategia de Forex sobre MT4\/MT5/i);
    fireEvent.click(screen.getByText(/Crypto \(Coinbase\)/i));
    await fillName("Coinarb research v2");

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByTestId("step2-stub");

    fireEvent.click(screen.getByRole("button", { name: /Crear estrategia/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
    const [table, payload] = insertMock.mock.calls[0];
    expect(table).toBe("algorithms");
    expect(payload).toMatchObject({
      market_type: "crypto",
      platform: "fly",
      direction: "both",
      linked_bot_account_id: null,
    });
  });
});
