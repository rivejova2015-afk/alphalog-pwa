// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuizRunner } from "../QuizRunner.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

const questions = [
  { q: "¿Capital de la ciberseg?", o: ["Tecnología, Procesos, Personas", "Solo firewalls"], c: 0, e: "Combina los tres." },
];

describe("QuizRunner — modo práctica", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("da feedback inmediato y muestra la explicación al responder", async () => {
    render(<QuizRunner lessonId={1} lessonTitle="Test" questions={questions} />);
    // explicación no visible aún
    expect(screen.queryByText(/Combina los tres/)).toBeNull();

    fireEvent.click(screen.getByText("Tecnología, Procesos, Personas"));

    // feedback inmediato: aparece la explicación
    await waitFor(() => expect(screen.getByText(/Combina los tres/)).toBeInTheDocument());
    // y guarda el resultado (POST a la API)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/securities/cybersec/quiz-results",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("ofrece los modos Práctica y Test", () => {
    render(<QuizRunner lessonId={1} lessonTitle="Test" questions={questions} />);
    expect(screen.getByRole("button", { name: /Práctica/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test/ })).toBeInTheDocument();
  });
});

describe("QuizRunner — al aprobar (confirmación + navegación)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("muestra 'Guardado ✓' y el botón 'Continuar →' cuando hay próxima lección", async () => {
    render(
      <QuizRunner
        lessonId={1}
        lessonTitle="Test"
        questions={questions}
        moduleId={1}
        nextLessonId={2}
        nextLessonTitle="Tríada CIA"
      />,
    );
    fireEvent.click(screen.getByText("Tecnología, Procesos, Personas")); // respuesta correcta → 100%

    await waitFor(() => expect(screen.getByText(/Guardado ✓/)).toBeInTheDocument());
    const continuar = await screen.findByText(/Continuar: Tríada CIA/);
    expect(continuar).toBeInTheDocument();
    // marca el progreso del módulo al aprobar
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/securities/cybersec/progress",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("no muestra 'Continuar →' si no hay próxima lección", async () => {
    render(
      <QuizRunner lessonId={1} lessonTitle="Test" questions={questions} moduleId={1} nextLessonId={null} />,
    );
    fireEvent.click(screen.getByText("Tecnología, Procesos, Personas"));
    await waitFor(() => expect(screen.getByText(/Guardado ✓/)).toBeInTheDocument());
    expect(screen.queryByText(/Continuar/)).toBeNull();
  });
});
