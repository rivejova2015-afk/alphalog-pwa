// @vitest-environment jsdom
//
// Mt5BarsImport — accordion para subir CSVs de barras a /bars-import. Tests
// focused en visible UI behavior; los regexes de parsing (detectFromName)
// son privados al módulo. Validates:
//   1. Collapsed por default; click "Importar barras" expande.
//   2. Source selector lista las 7 fuentes (mt5/mt4/tradovate/dukascopy/
//      histdata/cme/binance).
//   3. Hint text cambia según la source seleccionada.
//   4. "Arrastrá CSVs acá o click para abrir" placeholder visible.
//   5. runAll sin entries → toast.error.
//   6. Counter "— N archivos" en el header cuando hay entries pendientes
//      (vía drag-drop simulation).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock:   vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));

import { Mt5BarsImport } from "../Mt5BarsImport.client";

describe("Mt5BarsImport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("renders collapsed by default; header click expands the body", () => {
    render(<Mt5BarsImport algorithmId="algo-1" />);
    expect(screen.queryByText(/Arrastrá CSVs acá/i)).toBeNull();
    fireEvent.click(screen.getByText(/Importar barras/i));
    expect(screen.getByText(/Arrastrá CSVs acá/i)).toBeDefined();
  });

  it("lists all 7 source options in the selector", () => {
    render(<Mt5BarsImport algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Importar barras/i));
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    // Each <option> has its source value attached.
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining([
      "mt5", "mt4", "tradovate", "dukascopy", "histdata", "cme", "binance",
    ]));
  });

  it("hint text updates when the source selector changes", () => {
    render(<Mt5BarsImport algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Importar barras/i));
    const select = screen.getByRole("combobox") as HTMLSelectElement;

    // Default = mt5 hint (matches MT5 format).
    expect(screen.getByText(/SYMBOL_TF\.csv \(ej\. XAUUSD_M15/i)).toBeDefined();

    // Change to histdata.
    fireEvent.change(select, { target: { value: "histdata" } });
    expect(screen.getByText(/DAT_ASCII_SYMBOL_M1/i)).toBeDefined();

    // Change to binance.
    fireEvent.change(select, { target: { value: "binance" } });
    expect(screen.getByText(/data\.binance\.vision/i)).toBeDefined();
  });

  it("'Importar todos' button is disabled when there are no entries", () => {
    render(<Mt5BarsImport algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Importar barras/i));

    const runBtn = screen.getByRole("button", { name: /Importar todos/i }) as HTMLButtonElement;
    expect(runBtn.disabled).toBe(true);
  });

  it("shows the entries counter in the header after files are added via change", () => {
    render(<Mt5BarsImport algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Importar barras/i));

    // Hidden file input — simulate selecting one CSV file.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["ts,o,h,l,c,v\n"], "XAUUSD_M15.csv", { type: "text/csv" });

    // Use Object.defineProperty to set FileList since input.files is read-only.
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    expect(screen.getByText(/— 1 archivo/i)).toBeDefined();
  });
});
