# 🧪 Sprint 4.7 - Testing Guide

**Quick Verification (5-10 minutes)**

---

## ✅ Pre-Testing Setup

1. **Dev server corriendo**:
   ```bash
   npm run dev
   ```
   Expected: "✓ Ready in Xms" a http://localhost:3000

2. **Abre DevTools** (F12) → Console
   - Busca logs con `[CalendarPanel]`, `[EvidenceReports]`, `[SeedCategoriesButton]`
   - Verifica NO hay "instruments.map is not a function" o "reports.find is not a function"

---

## 🧪 Test Cases

### Test 1: Terminal → Calendario (instruments.map fix)

**Steps**:
1. Nav a http://localhost:3000/dashboard/terminal
2. Click tab "📅 Calendario"
3. Observa el select dropdown de Instrumentos

**Expected Behavior** ✅:
- [x] Select renderiza (NO crash)
- [x] Si instruments vacío: muestra "Cargando instrumentos..."
- [x] Si hay datos: lista normal de instrumentos
- [x] Console: VER logs `[CalendarPanel:instruments] Data refrescada exitosamente`

**If crashes**:
- [ ] Console mostraría error (rojo)
- [ ] Deberías ver TypeError: instruments.map is not a function
- Si ves esto → fix no se aplicó correctamente

---

### Test 2: Terminal → Evidencia (reports.find fix)

**Steps**:
1. Nav a http://localhost:3000/dashboard/terminal
2. Click tab "📊 Evidencia (IA)"
3. Observa la lista de reportes a la izquierda
4. Si hay reportes, click uno

**Expected Behavior** ✅:
- [x] Lista reportes renderiza (NO crash)
- [x] Si reports vacío: dice "Sin reportes aún"
- [x] Si hay reportes: lista clickeable
- [x] Al hacer click: detalle aparece a la derecha
- [x] Console: logs `[EvidenceReports:reports] Data refrescada exitosamente`

**If crashes**:
- [ ] Console mostraría TypeError: reports.find is not a function
- Si ves esto → fix no se aplicó correctamente

---

### Test 3: SeedCategoriesButton (error handling + retry)

**Steps**:
1. Nav a http://localhost:3000/dashboard/logs
2. Busca o abre modal de "Nuevo Log"
3. En el form, busca botón "Crear categorías sugeridas"
4. Click botón

**Expected Behavior** ✅:
- [x] Botón muestra "Creando..." (loading state)
- [x] Después de ~1-2s: 
  - Si éxito: botón vuelve a "Crear categorías sugeridas"
  - Si falla (conexión/servidor): muestra mensaje de error + botón "🔄 Reintentar"
- [x] Mensaje de error es ESPECÍFICO (no genérico)
  - Ej: "Error al crear algunas categorías. Propfirm Forex: HTTP 409..."
- [x] Console: logs `[SeedCategoriesButton] ...`

**If error es genérico**:
- [ ] Botón muestra "Error al crear categorías sugeridas"
- [ ] NO hay botón reintentar
- Si ves esto → fix no se aplicó correctamente

---

### Test 4: Auto-Refresh & Concurrency Control

**Steps**:
1. Abre DevTools Console
2. Filtra logs por `useAutoRefresh`
3. Nav a /dashboard/terminal → tab Calendario
4. Observa logs por 120 segundos

**Expected Behavior** ✅:
- [x] Ves logs iniciales: "Data refrescada exitosamente"
- [x] A los ~60s: Ves otro log de refresh (sin duplicados)
- [x] Si hay muchos logs = fetch duplicado (malo)
- [x] Console NO muestra "Fetch en progreso, ignorando request duplicado" (buena señal = lock funciona)

**Test Concurrency**:
1. Abre 2 tabs simultáneamente: ambas en /dashboard/terminal
2. Cada una hace fetch de instruments
3. Console debe mostrar solo UNA línea de fetch por tab (no 2 simultáneas)

---

### Test 5: Revalidate on Focus

**Steps**:
1. Tab Calendario abierto
2. Abre DevTools Console
3. Cambia a otra pestaña del navegador (20 segundos)
4. Vuelve a la pestaña AlphaLog

**Expected Behavior** ✅:
- [x] Console muestra log: "Tab enfocada, revalidando data..."
- [x] Hace un fetch adicional (no espera 60s)
- [x] Data se actualiza

---

### Test 6: Error Boundary

**Steps**:
1. En componente terminal, simular error forzado (opcional, para dev):
   - Editar CalendarPanel: en fetchInstruments, agregar `throw new Error("TEST")`
   - Build + reload
2. Nav a /dashboard/terminal
3. Ver si aparece error boundary

**Expected Behavior** ✅:
- [x] NO muestra blanco/infinito loop
- [x] Muestra card: "Oops, algo salió mal" ⚠️
- [x] Botón "🔄 Reintentar" funciona (usa reset())
- [x] En dev: muestra error.message pequeño abajo
- [x] Botón "← Volver al Dashboard" funciona

**If no error boundary**:
- [ ] Página blanca o infinito loop
- Si ves esto → error boundary no se registró correctamente

---

## 📊 Console Output Examples

### Esperado (Éxito):
```
[CalendarPanel:instruments] Data refrescada exitosamente {time: "2026-01-17T10:30:15.123Z"}
[EvidenceReports:reports] Data refrescada exitosamente {time: "2026-01-17T10:30:16.456Z"}
[SeedCategoriesButton] Form submitted, seeding categories...
```

### Advertencia (No esperado, pero OK):
```
[CalendarPanel:instruments] Error retryable, reintentando en 1000ms {attempt: 1, error: "Network error"}
[useAutoRefresh] Fetch abortado por nueva request
```

### Error (Indica problema):
```
❌ TypeError: instruments.map is not a function
❌ TypeError: reports.find is not a function
❌ [CalendarPanel] GET /api/terminal/instruments returned 500
```

---

## 🎯 Success Criteria

| Criteria | Check |
|----------|-------|
| No TypeErrors (map/find) | ✅ |
| Calendario renderiza siempre | ✅ |
| Evidencia renderiza siempre | ✅ |
| Error message en SeedCategories es específico | ✅ |
| Botón Reintentar visible si falla | ✅ |
| Auto-refresh sin duplicados cada 60s | ✅ |
| Focus → revalidate funciona | ✅ |
| Error boundary atrapa crashes | ✅ |

---

## 🐛 Troubleshooting

**Q: Veo "instruments.map is not a function" en console**
- A: Copia del nuevo código no se reflejó. Intenta:
  ```bash
  rm -r .next
  npm run dev
  ```

**Q: Botón SeedCategories sigue mostrando error genérico**
- A: El fix en SeedCategoriesButton.client.tsx no se guardó. Verifica líneas ~45-80.

**Q: Auto-refresh no funciona (no veo logs cada 60s)**
- A: useAutoRefresh hook podría no estar integrado. Verifica CalendarPanel y EvidenceReports tienen el hook.

**Q: Error Boundary no aparece**
- A: Verifica archivo existe: `src/app/dashboard/terminal/error.tsx`
- A: Verifica que error sucede dentro de `/dashboard/terminal` (la carpeta correcta)

---

## ✨ Final Checklist

- [ ] Terminal → Calendario: No crash, select renderiza
- [ ] Terminal → Evidencia: No crash, list + detail funcionan
- [ ] Journal → SeedCategories: Error específico + retry
- [ ] Console limpia: No TypeErrors
- [ ] Auto-refresh visible en logs (~60s intervalo)
- [ ] Build passes: `npm run build` ✅

**If all ✅**: Sistema anti-bug está funcionando correctamente.

---

**Estimated Time**: 5-10 minutes  
**Difficulty**: Easy (mostly observation)  
**Priority**: HIGH (confirms all fixes)
