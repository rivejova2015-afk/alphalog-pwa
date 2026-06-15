// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CelebrationOverlay } from "../CelebrationOverlay.client";
import type { Milestone } from "@/lib/securities/cybersec";

describe("CelebrationOverlay", () => {
  it("no renderiza nada sin hitos", () => {
    const { container } = render(<CelebrationOverlay milestones={[]} />);
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("muestra el primer hito y avanza la cola al cerrar", () => {
    const milestones: Milestone[] = [
      { kind: "level", title: "¡Nivel 3!", detail: "Subiste de nivel" },
      { kind: "crown", title: "¡Nueva corona!", detail: "Ganaste maestría" },
    ];
    render(<CelebrationOverlay milestones={milestones} />);
    expect(screen.getByText("¡Nivel 3!")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Seguir/));
    // ahora muestra el segundo
    expect(screen.getByText("¡Nueva corona!")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Seguir/));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
