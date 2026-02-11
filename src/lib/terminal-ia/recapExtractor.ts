// Recap Extractor (news-only)
// Detecta artículos tipo “market recap” y construye la sección “Ayer”.

export interface Recap {
  id: string;
  direction: string;
  drivers: string[];
}

export function extractRecaps(news: { id: string; title: string; content: string }[]): Recap[] {
  // Simulación: busca "recap" en el título
  return news.filter(n => n.title.toLowerCase().includes("recap")).map(n => ({
    id: n.id,
    direction: "up", // placeholder
    drivers: ["macro", "yields"] // placeholder
  }));
}
