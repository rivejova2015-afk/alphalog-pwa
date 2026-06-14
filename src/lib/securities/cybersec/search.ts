import { SYLLABUS } from "./syllabus";

export interface SearchResult {
  m: number;
  title: string;
  cat: string;
  topics: string[];
  matched: string[]; // topics que matchearon (para resaltar)
  score: number;
}

// Normaliza para búsqueda: minúsculas + sin acentos.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Busca módulos por título, categoría y topics. Todos los tokens del query deben
// aparecer en algún lado; el ranking prioriza match en el título.
export function searchModules(query: string, limit = 30): SearchResult[] {
  const q = norm(query.trim());
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];
  for (const mod of SYLLABUS) {
    const title = norm(mod.title);
    const cat = norm(mod.cat);
    const topicsN = mod.topics.map(norm);
    const hay = [title, cat, ...topicsN].join(" ");

    if (!tokens.every((t) => hay.includes(t))) continue;

    let score = 0;
    const matched: string[] = [];
    for (const t of tokens) {
      if (title.startsWith(t)) score += 10;
      else if (title.includes(t)) score += 6;
      if (cat.includes(t)) score += 2;
      topicsN.forEach((tn, i) => {
        if (tn.includes(t)) {
          score += 3;
          if (!matched.includes(mod.topics[i])) matched.push(mod.topics[i]);
        }
      });
    }
    results.push({ m: mod.m, title: mod.title, cat: mod.cat, topics: mod.topics, matched, score });
  }
  return results.sort((a, b) => b.score - a.score || a.m - b.m).slice(0, limit);
}
