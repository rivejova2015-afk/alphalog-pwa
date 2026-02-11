// Smart Anti-Loop Advisor
// Sugiere links alternativos válidos si se intenta un link inválido (solo mensaje inline, sin popups).

export function suggestValidLink(currentId: string, targetId: string, allLinks: [string, string][]): string | null {
  // Si el link actual es inválido (crea ciclo), busca un link alternativo válido
  const isCycle = (from: string, to: string, links: [string, string][]): boolean => {
    const graph: Record<string, string[]> = {};
    links.forEach(([a, b]) => {
      if (!graph[a]) graph[a] = [];
      graph[a].push(b);
    });
    const visited = new Set<string>();
    function dfs(node: string): boolean {
      if (visited.has(node)) return true;
      visited.add(node);
      for (const child of graph[node] || []) {
        if (dfs(child)) return true;
      }
      visited.delete(node);
      return false;
    }
    return dfs(from);
  };
  if (!isCycle(currentId, targetId, allLinks)) return null;
  // Buscar un target alternativo que no cree ciclo
  for (const [from, to] of allLinks) {
    if (from === currentId && !isCycle(from, to, allLinks.filter(l => l !== [from, to]))) {
      return to;
    }
  }
  return null;
}
