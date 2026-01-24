# Fix para Error de Cookies en Server Components

## Problema
Error en producción (Vercel): "Cookies can only be modified in a Server Action or Route Handler"
- Stack trace apuntaba a `.next/server/app/page.js`
- Causa: `setAll()` en `createClient()` (server.ts) se ejecutaba durante render del Server Component

## Solución Implementada

### 1. **Modificado: `src/lib/supabase/server.ts`**
- Envuelto `cookieStore.set()` en try/catch con manejo defensivo
- Si se intenta setear cookies en un Server Component, se captura el error y se loggea
- Las cookies se actualizan a través del middleware (que SÍ puede modificarlas)

```typescript
// Ahora el setAll() es seguro:
setAll(cookiesToSet) {
  try {
    cookiesToSet.forEach(({ name, value, options }) => {
      cookieStore.set(name, value, options);
    });
  } catch (error) {
    // Captura el error pero no crashea - el middleware lo maneja
    console.debug('[Supabase] Cookie set deferred to middleware');
  }
}
```

### 2. **Modificado: `src/proxy.ts` (Middleware)**
- Ahora usa `createServerClient` directamente en el middleware
- Middleware CAN modificar cookies vía `response.cookies.set()`
- Las actualizaciones de sesión ocurren de forma segura aquí

```typescript
const supabase = createServerClient(..., {
  cookies: {
    setAll(cookiesToSet) {
      // SAFE: Middleware puede modificar cookies
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  }
});
```

### 3. **Nuevo: `src/app/api/auth/refresh/route.ts`**
- Route Handler explícito para refrescar sesión
- Usado para actualizaciones de autenticación en contexto seguro
- Endpoint: `POST /api/auth/refresh`

```typescript
// En Route Handler, setAll() es seguro:
setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    cookieStore.set(name, value, options); // SAFE
  });
}
```

### 4. **Modificado: `src/app/page.tsx`**
- Agregado error handling defensivo
- Nunca crashea si falta data de autenticación
- Logs útiles para debugging

## Flujo Seguro de Cookies

```
1. GET / (page.tsx - Server Component)
   ├─ Llama createClient()
   ├─ createClient() puede intentar setAll() pero es seguro (try/catch)
   └─ Loggea en server

2. Middleware ejecuta después
   ├─ Crea supabase client con response.cookies.set() disponible
   ├─ Llama auth.getUser() que puede actualizar cookies
   ├─ response.cookies.set() actualiza las cookies de forma segura
   └─ Retorna response con nuevas cookies

3. Cliente (si necesita refrescar)
   ├─ Puede llamar POST /api/auth/refresh
   ├─ Route Handler setea cookies de forma segura
   └─ Retorna datos de sesión
```

## Dónde Se Pueden Setear Cookies

| Contexto | Can Set Cookies? | Método |
|----------|------------------|--------|
| Server Component render | ❌ NO | - |
| Route Handler (API) | ✅ SÍ | `cookieStore.set()` o `response.cookies.set()` |
| Middleware | ✅ SÍ | `response.cookies.set()` |
| Server Action | ✅ SÍ | `cookies().set()` |
| Client Component | ❌ NO | (fetch a Route Handler) |

## Testing Local

```bash
# Build
npm run build

# Verificar que no hay errores
npm start

# Navegar a http://localhost:3000
# Debería redirigir a /auth (no hay sesión)

# Loggear con Google
# Callback en /auth/callback debería setear cookies (Route Handler = safe)

# Navegar a / nuevamente
# Debería redirigir a /dashboard (sesión presente en cookies)
```

## Redeploy en Vercel

1. El commit ya está en main: `a251506`
2. Vercel redeploy automático al pushear:
   ```bash
   git push origin main
   ```

3. Si necesitas redeploy manual:
   - Ir a Vercel dashboard
   - Seleccionar proyecto "alphalog-pwa"
   - Click en "Deployments"
   - Click en el commit más reciente
   - Click en "..." → "Redeploy"

4. Verificar en producción:
   - Navegar a https://alphalog.io/
   - Debería redirigir a /auth (sin errores de cookies)
   - Loggear y verificar que el callback funciona
   - Dashboard debería cargar correctamente

## Rollback (si algo falla)

```bash
git revert a251506
git push origin main
```

O revertir a commit anterior:
```bash
git reset --hard fbdea84
git push origin main --force-with-lease
```

## Cambios Incluidos

```
✅ src/lib/supabase/server.ts - try/catch en setAll()
✅ src/proxy.ts - Middleware con response.cookies.set()
✅ src/app/api/auth/refresh/route.ts - Route Handler para auth
✅ src/app/page.tsx - Error handling defensivo
```

## Ventajas

- ✅ Sin crashes en producción
- ✅ Cookies manejadas en contextos seguros (Middleware, Route Handlers)
- ✅ Error handling defensivo
- ✅ Backward compatible (auth flow sigue funcionando)
- ✅ Logs claros para debugging

## Next Steps (Opcional)

Si quieres mejorar aún más:

1. Usar Server Actions explícitas para operaciones que necesiten cookies
2. Agregar telemetría para monitorear fallos de cookies
3. Implementar retry logic en middleware para refrescar sesión
4. Usar `next/headers` más explícitamente en Route Handlers
