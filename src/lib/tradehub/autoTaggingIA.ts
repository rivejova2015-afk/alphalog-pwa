// Auto-Tagging IA del Journal
// Sugiere tags consistentes y evita duplicados.

export function suggestTags(input: string[]): string[] {
  // Normaliza y deduplica
  return Array.from(new Set(input.map(t => t.trim().toLowerCase())));
}
