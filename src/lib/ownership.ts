// El Postgres crudo (getPgClient) no tiene RLS -- cada ruta que antes
// confiaba en una policy de Supabase (`auth.uid() = user_id`) para el
// scoping ahora debe filtrar explícitamente. Este helper es el único punto
// donde vive ese chequeo (Ajuste #11), en vez de repetirlo a mano en cada
// una de las 12 rutas API que tocan tablas CME.

export function requireOwnership<T extends { user_id: string }>(
  row: T | null,
  userId: string,
): T | null {
  if (!row) return null;
  if (row.user_id !== userId) return null;
  return row;
}
