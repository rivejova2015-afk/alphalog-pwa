# SPRINT 3.2 TESTING GUIDE — Manual QA Checklist

**Purpose**: Step-by-step guide to test Logs UI implementation  
**Estimated Time**: 2-3 hours (manual testing)  
**Prerequisites**: 
- Supabase project with Migration 002 applied (`supabase/migrations/002_logs_schema.sql`)
- `.env.local` with valid NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
- `npm run dev` running successfully

---

## Setup

### 1. Ensure Migration is Applied
```bash
# Check Supabase Dashboard → SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN 
('categories', 'tags', 'logs', 'log_tags', 'log_attachments');
-- Expected: 5 rows
```

### 2. Start Dev Server
```bash
npm run dev
# Expected output: "Ready in XXms"
```

### 3. Create Test Account (or use existing)
- Open: http://localhost:3000
- Click: "Continuar con Google"
- Authorize with Google account
- Should redirect to / with email shown

---

## Test Suite (Follow in Order)

### GROUP 1: Authentication & Navigation

#### Test 1.1: Access without login
- [ ] Open new incognito window
- [ ] Go to: http://localhost:3000/dashboard/logs
- [ ] Expected: Redirects to http://localhost:3000/auth
- [ ] Expected: See login button

#### Test 1.2: Access with valid session
- [ ] Close incognito, go back to logged-in window
- [ ] Go to: http://localhost:3000/dashboard/logs
- [ ] Expected: Page loads, shows header with email
- [ ] Expected: "Logs" title visible

#### Test 1.3: Session persistence
- [ ] Refresh page (F5)
- [ ] Expected: Session persists, still logged in
- [ ] Expected: No redirect to /auth

---

### GROUP 2: Categories Management

#### Test 2.1: Seed categories
- [ ] On Logs page, click "Crear categorías sugeridas" button
- [ ] Expected: Button shows "Creando..."
- [ ] Expected: Button returns to normal after 1-2s
- [ ] Expected: No error messages

#### Test 2.2: Verify categories created
- [ ] Open DevTools → Console
- [ ] Run: `await fetch('/api/categories').then(r => r.json()).then(d => console.log(d))`
- [ ] Expected: Returns array with 5 categories:
  - "Propfirm Forex"
  - "Propfirm Futuros"
  - "Forex Real"
  - "Futuros Real"
  - "Opciones"

#### Test 2.3: Categories in dropdown
- [ ] Click "+ Nuevo Log" button
- [ ] Modal opens
- [ ] Scroll to "Categoría" dropdown
- [ ] Expected: Dropdown shows all 5 categories
- [ ] Expected: No duplicates

#### Test 2.4: Anti-duplicados (categories)
- [ ] Close modal (click Cancelar)
- [ ] Console: 
```javascript
await fetch('/api/categories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Propfirm Forex' })
}).then(r => r.json()).then(d => console.log(d))
```
- [ ] Expected: Returns 409 status + "Category already exists"

---

### GROUP 3: CRUD Logs (Create)

#### Test 3.1: Create new log (basic)
- [ ] Click "+ Nuevo Log"
- [ ] Modal opens, title: "Nuevo Log"
- [ ] Fill fields:
  - Title: "My First Log"
  - Notes: "This is a test log"
  - Type: "Trading"
  - Category: Select "Propfirm Forex"
  - Tags: Leave empty
- [ ] Click "Crear"
- [ ] Expected: Modal closes
- [ ] Expected: Log appears in list with title "My First Log"
- [ ] Expected: Shows category "Propfirm Forex" + type "Trading"

#### Test 3.2: Create log with tags
- [ ] Click "+ Nuevo Log"
- [ ] Fill fields:
  - Title: "Log with tags"
  - Notes: "Testing tags feature"
  - Category: "Propfirm Futuros"
- [ ] In "Tags" field, type "trading"
- [ ] Press Enter
- [ ] Expected: Tag "trading" appears as blue pill above input
- [ ] Type "analysis"
- [ ] Press Enter
- [ ] Expected: Two tags: "trading" + "analysis"
- [ ] Click "Crear"
- [ ] Expected: Log created
- [ ] Expected: Shows tags: "🏷️ trading, analysis"

#### Test 3.3: Tags suggestions (dropdown)
- [ ] Click "+ Nuevo Log"
- [ ] In Tags field, type "tra"
- [ ] Expected: Dropdown shows "trading" as suggestion
- [ ] Click "trading" from dropdown
- [ ] Expected: Tag added (no need to press Enter)
- [ ] Close modal

#### Test 3.4: Max tags limit (25)
- [ ] Click "+ Nuevo Log"
- [ ] In Tags field, add 25 tags (type "tag1", Enter, "tag2", Enter, ... "tag25", Enter)
- [ ] Expected: Input disables after 25th tag
- [ ] Expected: Shows message "Máximo 25 tags alcanzado"
- [ ] Try typing more
- [ ] Expected: Input field doesn't accept input
- [ ] Click Cancelar

---

### GROUP 4: CRUD Logs (Read & Filter)

#### Test 4.1: List all logs
- [ ] Should see all 2+ logs created in Group 3
- [ ] Expected: Sorted by sort_index (asc), then created_at (desc)

#### Test 4.2: Search filter
- [ ] In "Buscar" field, type "First"
- [ ] Expected: List updates immediately, shows only "My First Log"
- [ ] Clear search
- [ ] Expected: All logs visible again

#### Test 4.3: Category filter
- [ ] In "Categoría" dropdown, select "Propfirm Futuros"
- [ ] Expected: Shows only logs with that category
- [ ] Select "Propfirm Forex"
- [ ] Expected: Shows only Forex logs
- [ ] Select "Todas"
- [ ] Expected: All logs visible

#### Test 4.4: Type filter
- [ ] In "Tipo" field, type "Trading"
- [ ] Expected: Shows logs with type "Trading"
- [ ] Clear field
- [ ] Expected: All logs visible

#### Test 4.5: Combined filters
- [ ] Category: "Propfirm Forex"
- [ ] Type: "Trading"
- [ ] Expected: Only "My First Log" (if it's the only Forex + Trading)
- [ ] Clear all filters
- [ ] Expected: All logs visible

#### Test 4.6: Empty results
- [ ] Category: "Propfirm Forex"
- [ ] Type: "Nonexistent"
- [ ] Expected: Empty state: "No hay logs. ¡Crea uno!"

---

### GROUP 5: Pagination

#### Test 5.1: Create many logs (for pagination test)
- [ ] Create 51+ logs quickly:
```javascript
// In DevTools console:
for (let i = 1; i <= 51; i++) {
  await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Log ${i}`,
      notes: `Notes for log ${i}`,
      categoryId: 'CATEGORY_UUID_HERE', // Replace with actual UUID
      type: null,
      tagNames: []
    })
  });
  console.log(`Created log ${i}`);
}
```
- [ ] Or create manually 51+ times (tedious, but works)

#### Test 5.2: Pagination display
- [ ] On Logs page
- [ ] Expected: Shows first 50 logs
- [ ] Expected: Pagination buttons visible: 1, 2
- [ ] Expected: Text: "Mostrando 50 de 51+ logs (página 1)"

#### Test 5.3: Navigate pages
- [ ] Click page "2"
- [ ] Expected: URL changes to `?page=2`
- [ ] Expected: Shows logs 51-100 (or fewer if less than 100 total)
- [ ] Expected: Page "2" button is highlighted (blue)
- [ ] Click page "1"
- [ ] Expected: Back to first page

---

### GROUP 6: CRUD Logs (Update)

#### Test 6.1: Edit log
- [ ] On Logs page, find "My First Log"
- [ ] Click "Editar" button
- [ ] Modal opens, title: "Editar Log"
- [ ] Expected: Form pre-filled with:
  - Title: "My First Log"
  - Notes: (original text)
  - Type: "Trading"
  - Category: "Propfirm Forex"
- [ ] Change Title: "My Updated First Log"
- [ ] Click "Actualizar"
- [ ] Expected: Modal closes
- [ ] Expected: List shows updated title "My Updated First Log"

#### Test 6.2: Edit tags
- [ ] Click Editar on "Log with tags"
- [ ] Expected: Tags field shows "trading", "analysis"
- [ ] Click X on "analysis"
- [ ] Expected: Tag removed
- [ ] Type "newTag", press Enter
- [ ] Expected: "newTag" added
- [ ] Click "Actualizar"
- [ ] Expected: Tags updated

---

### GROUP 7: Duplicados (Anti-Duplicate) Handling

#### Test 7.1: Duplicate title same day UTC
- [ ] Click "+ Nuevo Log"
- [ ] Title: "My First Log" (same as existing log created today)
- [ ] Notes: "Different notes"
- [ ] Category: any
- [ ] Click "Crear"
- [ ] Expected: Error message appears:
  - Text: "Ya existe un log con ese título hoy (UTC). Cambia el título o edita el existente."
- [ ] Expected: Modal stays open (doesn't close)
- [ ] Expected: Form data preserved

#### Test 7.2: Duplicate check is case-insensitive
- [ ] In same modal, change Title: "my first log" (lowercase)
- [ ] Click "Crear"
- [ ] Expected: Same error message (case-insensitive check)

#### Test 7.3: Duplicate check ignores soft-deleted logs
- [ ] Close modal
- [ ] Delete the "My First Log" (soft-delete)
- [ ] Click "+ Nuevo Log"
- [ ] Title: "My First Log" (same title as deleted log)
- [ ] Click "Crear"
- [ ] Expected: Creation succeeds (soft-delete ignored)
- [ ] Expected: Log created
- [ ] Expected: Now have 2 "My First Log" (one active, one deleted)

---

### GROUP 8: CRUD Logs (Delete)

#### Test 8.1: Soft delete
- [ ] Click "+ Nuevo Log"
- [ ] Create: "Temp Log"
- [ ] List should show new log
- [ ] Click "Borrar" button on "Temp Log"
- [ ] Expected: Confirmation dialog: "¿Estás seguro...?"
- [ ] Click OK
- [ ] Expected: Log disappears from list
- [ ] Expected: List refreshes

#### Test 8.2: Log appears in trash
- [ ] Check "Ver papelera (eliminados)" checkbox
- [ ] Expected: List shows deleted logs
- [ ] Expected: "Temp Log" visible in trash
- [ ] Expected: Buttons change to "Restaurar" (green) + "Borrar" (gray)

#### Test 8.3: Restore log
- [ ] In trash view, click "Restaurar" on "Temp Log"
- [ ] Expected: Log disappears from trash
- [ ] Uncheck "Ver papelera"
- [ ] Expected: "Temp Log" visible in active list again

#### Test 8.4: Permanent delete (hard delete)
- [ ] Check "Ver papelera"
- [ ] Find a deleted log
- [ ] Click "Borrar" button (gray)
- [ ] Expected: Confirmation: "¿Estás seguro...?"
- [ ] Click OK
- [ ] Expected: Log removed completely
- [ ] Expected: Doesn't reappear even when viewing trash

#### Test 8.5: Attachments marked deleted
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run query (assuming you created logs with attachments):
```sql
SELECT * FROM public.log_attachments 
WHERE user_id = auth.uid() AND deleted_at IS NOT NULL;
```
- [ ] Expected: If log was soft-deleted, its attachments also have deleted_at set
- [ ] (Skip if no attachments created yet)

---

### GROUP 9: Edge Cases & Error Handling

#### Test 9.1: Missing required fields
- [ ] Click "+ Nuevo Log"
- [ ] Leave Title empty
- [ ] Try to click "Crear"
- [ ] Expected: Error message: "Por favor completa todos los campos obligatorios"

#### Test 9.2: Missing notes
- [ ] Title: "Title"
- [ ] Notes: (empty)
- [ ] Click "Crear"
- [ ] Expected: Error message

#### Test 9.3: Missing category
- [ ] Title: "Title"
- [ ] Notes: "Notes"
- [ ] Category: (select first option "Selecciona una categoría...")
- [ ] Click "Crear"
- [ ] Expected: Error message

#### Test 9.4: Network error handling
- [ ] Open DevTools → Network
- [ ] Throttle to "Offline"
- [ ] Click "+ Nuevo Log"
- [ ] Fill form
- [ ] Click "Crear"
- [ ] Expected: Error message: "Error al guardar el log. Intenta de nuevo."
- [ ] Go back online
- [ ] Retry: should work

#### Test 9.5: Invalid category UUID
- [ ] (Advanced) Manually POST with invalid categoryId
- [ ] Expected: Server returns error (FK constraint violated)

---

### GROUP 10: Performance

#### Test 10.1: List performance with many logs
- [ ] With 51+ logs created
- [ ] Navigate to page with all logs loaded
- [ ] Expected: No lag, smooth scrolling
- [ ] Expected: Page loads within 2 seconds

#### Test 10.2: Filter performance
- [ ] Type in search field
- [ ] Expected: List updates smoothly
- [ ] Expected: No excessive requests (check Network tab)

#### Test 10.3: Modal performance
- [ ] Open LogEditor
- [ ] Type in TagsInput
- [ ] Expected: Suggestions dropdown responsive (< 500ms)

---

## Summary & Sign-Off

### Issues Found
(List any bugs or unexpected behavior)

- [ ] Issue 1: ...
- [ ] Issue 2: ...

### Tests Passed
- [x] Authentication & Navigation (GROUP 1)
- [ ] Categories Management (GROUP 2)
- [ ] CRUD Logs Create (GROUP 3)
- [ ] CRUD Logs Read & Filter (GROUP 4)
- [ ] Pagination (GROUP 5)
- [ ] CRUD Logs Update (GROUP 6)
- [ ] Duplicados Handling (GROUP 7)
- [ ] CRUD Logs Delete (GROUP 8)
- [ ] Edge Cases (GROUP 9)
- [ ] Performance (GROUP 10)

### Overall Status
- **Ready for Deployment**: [ ] Yes / [ ] No (if no, list blockers)

**Tested By**: ________________  
**Date**: __________________  
**Notes**: __________________________________________________________________

---

## Troubleshooting

### Logs page shows "Error al cargar los logs"
- Check API response: `await fetch('/api/logs').then(r => r.json())`
- Verify session is valid: `await supabase.auth.getUser()`
- Check Supabase logs: Dashboard → Logs (bottom left)

### Categories dropdown empty
- Click "Crear categorías sugeridas"
- Or manually: `await fetch('/api/categories', { method: 'POST', body: ... })`

### Tags dropdown not showing suggestions
- Ensure tags exist: `/api/tags` endpoint returns items
- Check console for errors

### Duplicate error on new log with different title
- Verify title is actually different (check for trailing spaces)
- Confirm log is from today (UTC timezone)

---

**Test Guide Version**: 1.0  
**Last Updated**: 2026-01-17
