# TROUBLESHOOTING - AlphaLog Auth Google OAuth

Guía de troubleshooting para el flujo de autenticación con Google OAuth + Supabase (PKCE).

---

## Flujo Esperado

1. Usuario navega a `/auth`
2. Usuario hace click en "Continuar con Google"
3. Se abre ventana de Google (OAuth consent)
4. Usuario autoriza y Google lo redirige a: `/auth/callback?code=...`
5. Servidor intercambia `code` por sesión (exchangeCodeForSession)
6. Servidor redirige a `/` (home)
7. Home renderiza: "Bienvenido, {email}"

---

## URLs Requeridas en Supabase Dashboard

**Auth → Redirect URLs**, deben incluir:
- `http://localhost:3000/auth/callback` (dev)
- `http://127.0.0.1:3000/auth/callback` (si usas localhost IP)
- Si tienes IP pública: `http://<tu-ip>:3000/auth/callback`

**Auth → Site URL**:
- `http://localhost:3000`

---

## Problemas Comunes y Soluciones

### 1. **URL de Retorno: `/auth?error=missing_code#access_token=...`**

**Síntoma**: Al volver de Google, el código falta en query params, hay `#access_token=` en el hash.

**Causa**: Está ocurriendo implicit flow (OAuth 2.0 legacy) en lugar de PKCE.

**Solución**:
- [ ] Verifica que `src/lib/supabase/browser.ts` tenga `flowType: "pkce"`
- [ ] Verifica que `src/app/auth/page.tsx` use `createClient()` de `@/lib/supabase/browser` (NO `@supabase/supabase-js`)
- [ ] Revisa Supabase Dashboard → Auth → Authentication → Auth Type: debe estar en PKCE
- [ ] Limpia caché del navegador (Ctrl+Shift+Del) y cookies

**Pasos para verificar**:
```bash
# 1. Asegúrate de que el cliente tenga PKCE configurado
grep -n "flowType" src/lib/supabase/browser.ts
# Debe mostrar: "flowType: \"pkce\""

# 2. Verifica auth/page.tsx importa el cliente correcto
grep -n "import.*browser" src/app/auth/page.tsx
# Debe mostrar: "@/lib/supabase/browser"

# 3. En el navegador, abre DevTools → Network
# Busca la primera redirección a Google (accounts.google.com)
# En la URL debe haber "response_type=code" (PKCE) NO "response_type=token" (Implicit)
```

---

### 2. **Pantalla en Blanco en `/`**

**Síntoma**: Al llegar a home logueado, solo se ve blanco.

**Causa**: 
- Service Worker cacheando incorrectamente en dev
- Layout o página esperando indefinidamente por datos
- Error silencioso en getUser()

**Solución**:
- [ ] En `src/app/layout.tsx`, asegúrate que Service Worker SOLO se registra en production:
  ```tsx
  {process.env.NODE_ENV === "production" ? <ServiceWorkerRegister /> : null}
  ```
- [ ] En `src/app/page.tsx`, usa `try/catch` y muestra fallback si hay error
- [ ] Abre DevTools → Console y revisa si hay errores rojos
- [ ] Pasos:
  ```bash
  # 1. Limpiar .next
  rm -rf .next
  
  # 2. Limpiar caché del navegador
  # DevTools → Application → Storage → Clear All
  
  # 3. npm run dev
  # Luego navega a http://localhost:3000 (no /auth)
  # Si estás logueado, debe redirigir a /auth
  # Si no estás logueado, debes ver h1 "AlphaLog" + link a /auth
  ```

---

### 3. **Conflicto de Rutas: "route at /route and page at /page"**

**Síntoma**: Error de compilación mencionando conflicto de rutas.

**Causa**: Existe `src/app/route.ts` y también `src/app/page.tsx` (no pueden coexistir en el mismo directorio).

**Solución**:
- [ ] Verifica que NO exista `src/app/route.ts`
  ```bash
  ls -la src/app/route.ts  # No debe existir
  ```
- [ ] Si es un endpoint, muévelo a `src/app/api/...`
- [ ] La home debe ser `src/app/page.tsx` (página) o `src/app/route.ts` (endpoint API), pero no ambos

---

### 4. **Advertencia: "middleware file convention is deprecated"**

**Síntoma**: En logs de `npm run dev`, aparece advertencia sobre middleware.

**Causa**: Versión nueva de Next.js ha deprecado `src/middleware.ts` en favor de `next.config.ts` proxy.

**Solución** (TEMPORAL, está en progreso):
- [ ] Si tu `middleware.ts` existe, puedes ignorar la advertencia por ahora (sigue funcionando)
- [ ] Si quieres usar `next.config.ts` proxy en el futuro:
  ```typescript
  // next.config.ts
  const config: NextConfig = {
    experimental: {
      authInterceptors: true, // Enable proxy pattern
    },
  };
  ```
- [ ] Por ahora, mantenemos `middleware.ts` que llama a `proxy()` de `src/proxy.ts`

---

### 5. **Error: "Missing Code" después de Google OK**

**Síntoma**: Google muestra "Este sitio no puede acceder a tu información..." o "Redirect URI mismatch".

**Causa**: La URL de redirección registrada en Google (Supabase OAuth app) no coincide con lo que Google espera.

**Solución**:
- [ ] En Supabase Dashboard → Auth → Providers → Google
  - Verifica "Redirect URLs for OAuth"
  - Debe incluir exactamente: `http://localhost:3000/auth/callback`
  - Si usas IP, agrega también: `http://<tu-ip>:3000/auth/callback`

- [ ] En tu código (`src/app/auth/page.tsx`), verifica que `redirectTo` sea:
  ```typescript
  const redirectTo = `${window.location.origin}/auth/callback`;
  // Si estás en localhost:3000, será: http://localhost:3000/auth/callback
  // Si estás en 10.0.0.75:3000, será: http://10.0.0.75:3000/auth/callback
  ```

- [ ] Pasos para probar con IP diferente:
  ```bash
  # Encuentra tu IP local
  ipconfig getifaddr en0  # macOS
  # o
  hostname -I  # Linux/WSL
  
  # Luego accede en el navegador:
  http://<tu-ip>:3000/auth
  
  # Asegúrate de que esa IP también esté en Supabase Redirect URLs
  ```

---

## Checklist de Verificación Rápida

Ejecuta estos pasos en orden:

```bash
# 1. Verifica que el health endpoint funciona
curl http://localhost:3000/api/health
# Debe retornar: { "ok": true, "ts": <number> }

# 2. Abre /auth en navegador
# http://localhost:3000/auth
# Debes ver: h1 "Iniciar sesión - AlphaLog" + botón "Continuar con Google"

# 3. Abre DevTools (F12) → Network tab
# Haz click en "Continuar con Google"
# Debes ver una redirección a: accounts.google.com/...?response_type=code&...
# (NO debe haber "response_type=token")

# 4. Autoriza en Google
# Debes volver a: http://localhost:3000/auth/callback?code=...
# (NO debe ser: /auth?error=missing_code#access_token=...)

# 5. Automáticamente debes ver: h1 "Bienvenido a AlphaLog" + email + botón Logout
# Si ves eso, ¡SUCCESS! 🎉

# 6. Si algo falla, abre Console (DevTools)
# Busca logs rojos (errores) o naranjas (warnings)
```

---

## 6. **OAuth Login → Dashboard Redirect (SPRINT 4.6 Fix)**

**Síntoma**: Después de autenticarse con Google OAuth, usuario ve pantalla de "Próximos pasos" en home (/) en lugar de ir a dashboard.

**Causa**: Antes del fix:
- `/` (home) renderizaba contenido en lugar de redirigir a `/dashboard`
- `/auth/callback` redirigía a `/` (home) en lugar de `/dashboard`
- No existía `src/app/dashboard/page.tsx` (solo existían sub-páginas: tradehub, terminal, logs)

**Solución Implementada (✅ COMPLETADA)**:

### Cambios Realizados

**1. Simplificación de `src/app/page.tsx` (Home)**:
```typescript
// ANTES: Mostraba "Bienvenido" + "Próximos pasos"
export default async function Home() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) redirect("/auth");
  
  return (
    <main>
      <h1>Bienvenido a AlphaLog</h1>
      <p>Usuario: {data.user.email}</p>
      <p>Próximos pasos: ...</p> {/* ← PROBLEMA */}
    </main>
  );
}

// DESPUÉS: Solo redirige
export default async function Home() {
  const { data, error } = await supabase.auth.getUser();
  if (!error && data?.user) {
    redirect("/dashboard"); // ← Redirige a dashboard si autenticado
  }
  redirect("/auth"); // ← Redirige a login si no autenticado
}
```

**2. Nueva `src/app/dashboard/page.tsx` (Dashboard Principal)**:
```typescript
// Nuevo archivo: Server Component protegido por SSR
// - Chequea sesión con getUser()
// - Si no hay usuario: redirect("/auth")
// - Si hay usuario: muestra dashboard con:
  - Header con bienvenida + email + logout button
  - Grid de navegación (TradeHub, Terminal, Journal PT)
  - Quick stats (Estado, Autenticación, DB, Versión)
  - Footer con info del proyecto
```

**3. Fix de `src/app/auth/callback/route.ts` (Callback OAuth)**:
```typescript
// ANTES
const next = url.searchParams.get("next") ?? "/"; // Redirigía a home

// DESPUÉS
const next = url.searchParams.get("next") ?? "/dashboard"; // Redirige a dashboard
```

### Flujo Completo Después del Fix

```
1. Usuario navega a http://localhost:3000
   ↓
2. Home (/page.tsx) chequea sesión:
   - ¿User autenticado? → redirect("/dashboard")
   - ¿Sin autenticar? → redirect("/auth")
   ↓
3. Si no autenticado → /auth (login page)
   Usuario hace click en "Continuar con Google"
   ↓
4. Google redirige a /auth/callback?code=...
   Servidor intercambia code por sesión
   callback/route.ts redirige a "/dashboard" ← FIX
   ↓
5. Dashboard (/dashboard/page.tsx) cargado
   - Chequea sesión (protegido SSR)
   - Muestra: Header + Navigation + Welcome + Stats
   - Usuario puede navegar: TradeHub, Terminal, Journal PT
```

### Pruebas Recomendadas

```bash
# 1. Test sin sesión
curl -i http://localhost:3000/
# Esperado: 307 redirect a /auth

# 2. Test dashboard directo sin sesión
curl -i http://localhost:3000/dashboard
# Esperado: 307 redirect a /auth

# 3. Verificar health endpoint (público)
curl http://localhost:3000/api/health
# Esperado: { "ok": true, "ts": <timestamp> }

# 4. Test manual en navegador
# a. Navega a http://localhost:3000 (sin sesión)
#    Esperado: Redirige a /auth, ves botón "Continuar con Google"
#
# b. Haz click en "Continuar con Google"
#    Esperado: Google login → consent → /auth/callback → /dashboard
#
# c. En /dashboard, ves:
#    - Header con email + logout
#    - Grid: TradeHub, Terminal, Journal PT
#    - Quick stats
#
# d. Haz click en TradeHub, Terminal, o Journal PT
#    Esperado: Cargan correctamente
#
# e. Haz click en logout
#    Esperado: Logout → /auth
#    Navega a /dashboard
#    Esperado: 307 redirect a /auth ✅
```

### Rollback (Si Necesario)

Si necesitas revertir estos cambios:

```bash
# 1. Revertir home page
git checkout src/app/page.tsx

# 2. Revertir callback
git checkout src/app/auth/callback/route.ts

# 3. Eliminar dashboard principal
rm src/app/dashboard/page.tsx

# 4. Rebuild
npm run build
```

---

## Logs de Debug

Para ayudarte a diagnosticar, hemos agregado logs claros en:

- `src/app/auth/page.tsx`: logs en `signInGoogle()`
- `src/app/auth/callback/route.ts`: logs detallados del servidor
- `src/app/page.tsx`: logs en getUser()

**Para ver logs del servidor**:
```bash
npm run dev
# Mira la terminal/consola donde corre el dev server
# Búsca líneas que empiezan con: [Auth], [Callback], [Home]
```

**Para ver logs del cliente**:
```
Abre DevTools (F12) → Console
Todos los logs de la app tienen prefijo: [Auth], [Home], etc.
```

---

## Si Nada de Esto Funciona

1. **Verifica `.env.local` tiene las variables correctas**:
   ```bash
   cat .env.local | grep SUPABASE
   # Debe mostrar:
   # NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   # NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Limpia todo y reinicia**:
   ```bash
   rm -rf .next node_modules
   npm install
   npm run dev
   ```

3. **Verifica Supabase Auth Settings**:
   - Supabase Dashboard → Project → Auth → Providers
   - Google debe estar enabled
   - Client ID y Client Secret deben estar presentes
   - Redirect URLs deben incluir tu URL

4. **Revisa browser DevTools**:
   - Network tab: ¿qué URLs se están llamando?
   - Console: ¿hay errores rojos?
   - Application → Cookies: ¿hay cookies de Supabase? (sb-access-token, sb-refresh-token)

5. **Contacta con el equipo** con:
   - URL exacta que intenta acceder
   - Pantalla completa de DevTools Console (todos los logs)
   - El URL completo que aparece en el navegador en cada paso

---

## Resumen de Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src/app/auth/page.tsx` | Login page (cliente) |
| `src/app/auth/callback/route.ts` | Callback handler (servidor) |
| `src/app/page.tsx` | Home page (servidor + cliente) |
| `src/lib/supabase/browser.ts` | Cliente Supabase para navegador (PKCE) |
| `src/lib/supabase/server.ts` | Cliente Supabase para servidor (SSR) |
| `src/proxy.ts` | Proxy para refrescar sesión en cada request |
| `src/app/api/health/route.ts` | Health check endpoint |
| `middleware.ts` | Middleware que llama al proxy |
| `src/components/LogoutButton.tsx` | Client Component con handler logout |

---

## Error: "Event handlers cannot be passed to Client Component props"

### Síntoma
```
Error: Event handlers cannot be passed to Client Component props.
<button ... onClick={function onClick} ...>
```
Este error aparece cuando un **Server Component** intenta definir o pasar event handlers (onClick, onSubmit, etc.).

### Causa
En Next.js 16 App Router:
- Server Components (por defecto, sin "use client") NO pueden tener event handlers directo
- Los handlers deben vivir en Client Components ("use client")
- Un Server Component PUEDE importar y renderizar un Client Component sin handlers

### Solución Implementada (✅ RESUELTO)

**Antes (INCORRECTO)**:
```tsx
// src/app/page.tsx (Server Component)
export default async function Home() {
  // ... auth check ...
  return (
    <>
      <LogoutButton /> {/* PROBLEMA: LogoutButton definido aquí como función con onClick */}
    </>
  );
}

function LogoutButton() {
  return <button onClick={() => logout()}>Cerrar sesión</button>; // ❌ Ilegal
}
```

**Después (CORRECTO)**:
```tsx
// src/app/page.tsx (Server Component)
"use client";  // ← NO, esto convertirlo todo a cliente es incorrecto
import LogoutButton from "@/components/LogoutButton"; // ← Importar Client Component

export default async function Home() {
  // ... auth check ...
  return <LogoutButton />; // ✅ Renderiza el Client Component (sin pasar handlers)
}
```

```tsx
// src/components/LogoutButton.tsx (Client Component)
"use client"; // ← Correcto: solo este componente necesita ser cliente

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/auth");
  };
  
  return <button onClick={handleLogout}>Cerrar sesión</button>; // ✅ Legal
}
```

### Checklist de Verificación

- [ ] `/src/app/page.tsx` es Server Component (sin "use client")
- [ ] `/src/app/auth/page.tsx` es Client Component ("use client" al inicio)
- [ ] `/src/components/LogoutButton.tsx` es Client Component ("use client" al inicio)
- [ ] LogoutButton importa createClient() desde `@/lib/supabase/browser`
- [ ] LogoutButton NO recibe handlers como props (cero props)
- [ ] page.tsx renderiza `<LogoutButton />` sin pasarle funciones
- [ ] npm run dev muestra "Ready in Xms" sin errores de "Event handlers"

---

**Última actualización**: 2026-01-17  
**Versión**: Alpha 1.0
