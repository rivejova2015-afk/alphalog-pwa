// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AchievementsView } from "../AchievementsView.client";

const summary = {
  achievements: [
    { id: "first_quiz", name: "Primer paso", desc: "Completá tu primer quiz", earned: true, progress: { cur: 1, target: 1 } },
    { id: "streak7", name: "Semana perfecta", desc: "Racha de 7 días", earned: false, progress: { cur: 2, target: 7 } },
  ],
};

describe("AchievementsView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => summary })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renderiza los logros desbloqueados y en progreso desde /summary", async () => {
    render(<AchievementsView />);
    await waitFor(() => expect(screen.getByText("Primer paso")).toBeInTheDocument());
    expect(screen.getByText("Semana perfecta")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 desbloqueados")).toBeInTheDocument();
    expect(screen.getByText("Desbloqueados (1)")).toBeInTheDocument();
    expect(screen.getByText("En progreso (1)")).toBeInTheDocument();
  });
});
