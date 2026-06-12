// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardDeck } from "../FlashcardDeck.client";

const cards = [
  { id: 1, cat: "Redes", front: "TCP", back: "Fiable con handshake" },
  { id: 2, cat: "Cripto", front: "AES", back: "Cifrado simétrico" },
];

describe("FlashcardDeck", () => {
  it("muestra el término de la primera tarjeta y el contador", () => {
    render(<FlashcardDeck cards={cards} categories={["Redes", "Cripto"]} />);
    expect(screen.getByText("TCP")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("voltea la tarjeta al hacer click (term → respuesta)", () => {
    render(<FlashcardDeck cards={cards} categories={["Redes", "Cripto"]} />);
    expect(screen.queryByText("Fiable con handshake")).toBeNull();
    fireEvent.click(screen.getByLabelText("Ver respuesta"));
    expect(screen.getByText("Fiable con handshake")).toBeInTheDocument();
  });

  it("avanza a la siguiente tarjeta", () => {
    render(<FlashcardDeck cards={cards} categories={["Redes", "Cripto"]} />);
    fireEvent.click(screen.getByLabelText("Siguiente"));
    expect(screen.getByText("AES")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("filtra por categoría", () => {
    render(<FlashcardDeck cards={cards} categories={["Redes", "Cripto"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cripto" }));
    expect(screen.getByText("AES")).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });
});
