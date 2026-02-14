const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MaybePromise<T> = T | Promise<T>;

type RouteContext<T extends Record<string, unknown> = Record<string, unknown>> = {
  params: MaybePromise<T>;
};

export async function resolveRouteParams<T extends Record<string, unknown>>(
  context: RouteContext<T>
): Promise<T> {
  return await context.params;
}

export async function resolveRouteId(
  context: RouteContext<{ id?: unknown }>,
  options?: { enforceUuid?: boolean }
): Promise<string | null> {
  const params = await resolveRouteParams(context);
  const rawId = params.id;

  if (typeof rawId !== "string") return null;
  const id = rawId.trim();
  if (!id) return null;

  const enforceUuid = options?.enforceUuid ?? true;
  if (enforceUuid && !UUID_REGEX.test(id)) return null;

  return id;
}
