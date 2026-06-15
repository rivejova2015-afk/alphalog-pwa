// @vitest-environment jsdom
//
// MindOpsPanel — render-only component que recibe MindOpsData precomputed
// y muestra tiles (entries/mood), correlation block (mood↔outcome), mood
// breakdown, top tags, action items.
//
// Validates:
//   1. EmptyState cuando !authenticated.
//   2. EmptyState cuando entries30d=0.
//   3. 4 tiles (entries 7d/30d, mood 7d/30d) renderizan con valores numéricos.
//   4. fmtScore: muestra "—" cuando moodScore7d=0; valor con 1 decimal cuando >0.
//   5. fmtCurrency: muestra "—" cuando highMoodAvgPnl=null.
//   6. fmtCurrency: formatea con symbol $ + maximumFractionDigits=0 cuando number.
//   7. biasSignal='positive' → header texto "Sesgo positivo".
//   8. biasSignal='negative' → header texto "Sesgo negativo".
//   9. biasSignal='neutral' → header texto "Sin sesgo claro".
//   10. moodBreakdown vacío → "Sin datos.".
//   11. moodBreakdown con items → lista con mood + count.
//   12. topTags vacío → "Sin tags.".
//   13. topTags con items → chips con tag y count.
//   14. actionItems con items → sección "Acciones recomendadas".
//   15. actionItems vacío → sección NO renderizada.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { MindOpsPanel } from "../MindOpsPanel.client";
import type { MindOpsData } from "@/lib/intelligence/metrics";

function makeData(over: Partial<MindOpsData> = {}): MindOpsData {
  return {
    authenticated: over.authenticated ?? true,
    entries7d:     over.entries7d  ?? 5,
    entries30d:    over.entries30d ?? 18,
    moodScore7d:   over.moodScore7d  ?? 6.4,
    moodScore30d:  over.moodScore30d ?? 5.8,
    topTags:       over.topTags ?? [],
    actionItems:   over.actionItems ?? [],
    moodBreakdown: over.moodBreakdown ?? [],
    moodOutcomeCorrelation: over.moodOutcomeCorrelation ?? {
      highMoodAvgPnl: 250,
      lowMoodAvgPnl: -80,
      biasSignal: "positive",
      correlationSampleSize: 12,
    },
  };
}

describe("MindOpsPanel", () => {
  it("EmptyState cuando !authenticated", () => {
    render(<MindOpsPanel data={makeData({ authenticated: false })} />);
    expect(screen.getByText(/Sin entradas de journal/i)).toBeDefined();
    expect(screen.getByText(/Empieza a escribir en \/business\/journal/i)).toBeDefined();
  });

  it("EmptyState cuando entries30d=0", () => {
    render(<MindOpsPanel data={makeData({ entries30d: 0, authenticated: true })} />);
    expect(screen.getByText(/Sin entradas de journal/i)).toBeDefined();
  });

  it("4 tiles renderizan con valores numéricos", () => {
    render(<MindOpsPanel data={makeData({ entries7d: 7, entries30d: 22 })} />);
    expect(screen.getByText("Entries 7d")).toBeDefined();
    expect(screen.getByText("Entries 30d")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("22")).toBeDefined();
    expect(screen.getByText("Mood score 7d")).toBeDefined();
    expect(screen.getByText("Mood score 30d")).toBeDefined();
  });

  it("fmtScore: muestra '—' cuando moodScore7d=0", () => {
    render(<MindOpsPanel data={makeData({ moodScore7d: 0, moodScore30d: 0 })} />);
    // both score tiles show "—" → at least 2 matches
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("fmtScore: valor formateado con 1 decimal cuando >0", () => {
    render(<MindOpsPanel data={makeData({ moodScore7d: 7.4, moodScore30d: 4.21 })} />);
    expect(screen.getByText("7.4")).toBeDefined();
    expect(screen.getByText("4.2")).toBeDefined();
  });

  it("fmtCurrency: muestra '—' cuando highMoodAvgPnl=null", () => {
    render(<MindOpsPanel data={makeData({
      moodOutcomeCorrelation: {
        highMoodAvgPnl: null, lowMoodAvgPnl: null,
        biasSignal: "neutral", correlationSampleSize: 0,
      },
    })} />);
    // At least 2 "—" in the correlation block
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("fmtCurrency: formatea como $250 (maximumFractionDigits=0)", () => {
    render(<MindOpsPanel data={makeData()} />);
    expect(screen.getByText("$250")).toBeDefined();
    // Negative formatted with parentheses or minus sign — accept either
    const lowMoodText = screen.queryByText(/-\$80|\(\$80\)/);
    expect(lowMoodText).not.toBeNull();
  });

  it("biasSignal='positive' → texto 'Sesgo positivo'", () => {
    render(<MindOpsPanel data={makeData({
      moodOutcomeCorrelation: {
        highMoodAvgPnl: 100, lowMoodAvgPnl: -50,
        biasSignal: "positive", correlationSampleSize: 5,
      },
    })} />);
    expect(screen.getByText(/Sesgo positivo/i)).toBeDefined();
  });

  it("biasSignal='negative' → texto 'Sesgo negativo'", () => {
    render(<MindOpsPanel data={makeData({
      moodOutcomeCorrelation: {
        highMoodAvgPnl: -100, lowMoodAvgPnl: 50,
        biasSignal: "negative", correlationSampleSize: 5,
      },
    })} />);
    expect(screen.getByText(/Sesgo negativo/i)).toBeDefined();
    expect(screen.getByText(/revenge \/ overconfidence/i)).toBeDefined();
  });

  it("biasSignal='neutral' → texto 'Sin sesgo claro'", () => {
    render(<MindOpsPanel data={makeData({
      moodOutcomeCorrelation: {
        highMoodAvgPnl: null, lowMoodAvgPnl: null,
        biasSignal: "neutral", correlationSampleSize: 0,
      },
    })} />);
    expect(screen.getByText(/Sin sesgo claro/i)).toBeDefined();
  });

  it("moodBreakdown vacío → 'Sin datos.'", () => {
    render(<MindOpsPanel data={makeData({ moodBreakdown: [] })} />);
    expect(screen.getByText("Sin datos.")).toBeDefined();
  });

  it("moodBreakdown con items → lista renderiza mood + count", () => {
    render(<MindOpsPanel data={makeData({
      moodBreakdown: [
        { mood: "calm",  count: 8 },
        { mood: "anxious", count: 3 },
      ],
    })} />);
    expect(screen.getByText(/calm/i)).toBeDefined();
    expect(screen.getByText(/anxious/i)).toBeDefined();
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("topTags vacío → 'Sin tags.'", () => {
    render(<MindOpsPanel data={makeData({ topTags: [] })} />);
    expect(screen.getByText("Sin tags.")).toBeDefined();
  });

  it("topTags con items → chips renderizan tag + count", () => {
    render(<MindOpsPanel data={makeData({
      topTags: [
        { tag: "fomo", count: 4 },
        { tag: "patient", count: 9 },
      ],
    })} />);
    expect(screen.getByText(/fomo/i)).toBeDefined();
    expect(screen.getByText(/patient/i)).toBeDefined();
    expect(screen.getByText("·4")).toBeDefined();
    expect(screen.getByText("·9")).toBeDefined();
  });

  it("actionItems con items → sección 'Acciones recomendadas' renderiza items", () => {
    render(<MindOpsPanel data={makeData({
      actionItems: ["Take a break after losses", "Journal before each session"],
    })} />);
    expect(screen.getByText(/Acciones recomendadas/i)).toBeDefined();
    expect(screen.getByText(/Take a break after losses/i)).toBeDefined();
    expect(screen.getByText(/Journal before each session/i)).toBeDefined();
  });

  it("actionItems vacío → sección NO renderizada", () => {
    render(<MindOpsPanel data={makeData({ actionItems: [] })} />);
    expect(screen.queryByText(/Acciones recomendadas/i)).toBeNull();
  });

  it("correlationSampleSize muestra el conteo de trades", () => {
    render(<MindOpsPanel data={makeData({
      moodOutcomeCorrelation: {
        highMoodAvgPnl: 100, lowMoodAvgPnl: -50,
        biasSignal: "positive", correlationSampleSize: 42,
      },
    })} />);
    expect(screen.getByText(/Muestra: 42 trades/i)).toBeDefined();
  });
});
