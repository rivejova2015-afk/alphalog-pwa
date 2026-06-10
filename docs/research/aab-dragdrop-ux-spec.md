# AAB Drag & Drop — UX Specification

> Fecha: 2026-06-10
> Estado: SPEC — no es código de producción.
> Desbloquea: `AabTreeView.client.tsx` (20% madurez, bloqueado por spec UX)

---

## 1. Estado actual

### Qué existe y funciona

| Componente | Archivo | Estado |
|---|---|---|
| Árbol de nodos (visual read-only) | `src/components/tradehub/aab/AabTreeView.client.tsx:39` | Funciona — renderiza `TreeNode` recursivo con indentación manual (`marginLeft: depth * 16`). |
| Panel derecho (CRUD de nodos/links) | `src/components/tradehub/aab/AabRightPanel.client.tsx:53` | Funciona — add node, add link, edit node risk/status, edit link multiplier/type, versiones, timeline, experiments. |
| Página AAB | `src/app/dashboard/tradehub/accounts/aab/page.tsx:75` | Funciona — selector de CopyGroup, vista árbol/lista, create group, feature flag guard. |
| Lista de slaves ordenable (DnD flat) | `src/components/copygroups/SortableSlavesList.client.tsx:42` | Funciona — `@dnd-kit` sortable flat list, optimistic, rollback, toast. Endpoint: `PATCH /api/copy-groups/[id]/nodes/reorder`. |
| Visualización SVG del grafo | `src/components/copygroups/CopyGroupGraph.client.tsx:27` | Funciona — SVG estático, click selecciona nodo, layout dos filas (masters/slaves). |
| Workspace integrado (en /copy-groups) | `src/components/copygroups/CopyGroupDetailWorkspace.client.tsx:50` | Funciona — integra CopyGroupGraph + SortableSlavesList + AabRightPanel. |
| Endpoint reorder flat | `src/app/api/copy-groups/[id]/nodes/reorder/route.ts:18` | Funciona — PATCH, actualiza `sort_index` en bulk, audit event `nodes_reordered`. |
| Schema `sort_index` en DB | `supabase/migrations/115_copy_group_nodes_sort_index.sql` | Aplicado. |
| Anti-loop DB trigger | `supabase/migrations/024_copy_groups_capital_algorithm.sql:250` | Funciona — `copy_group_links_guard` rechaza ciclos en `solid` links a nivel DB. |

### Qué NO existe (el 80% bloqueado)

1. **Drag & drop de nodos dentro del árbol jerárquico** (`AabTreeView` no tiene DnD). El componente es un árbol de lectura con `<button>` para selección. No hay handles, no hay drop zones, no hay `DndContext`.

2. **Operación de reparent por drag**: arrastrar un nodo slave de un parent a otro requiere DELETE del link existente + POST del nuevo link. No hay endpoint `PATCH /api/copy-groups/[id]/links` que modifique `parent_account_id` (el PATCH existente solo acepta `copy_multiplier` y `link_type`, `src/app/api/copy-groups/[id]/links/route.ts:87`).

3. **Drop de nodo huérfano al árbol**: la sección "Nodos sin conexión" (`AabTreeView.client.tsx:143`) es solo visual. No tiene DnD para conectar huérfanos.

4. **Feedback visual de DnD**: no hay ghost/preview, no hay drop zones coloreadas, no hay drag handle icons en los nodos del árbol (`AabTreeView`). `SortableSlavesList` sí los tiene pero es un componente separado (lista flat, no árbol).

5. **Accesibilidad del árbol**: el árbol usa `<div>` y `<button>` pero sin `role="tree"`, `role="treeitem"`, `aria-expanded`, ni navegación por teclado entre nodos. `AabTreeView.client.tsx:106`.

6. **Confirmación antes de reparent destructivo**: no hay `ConfirmDialog` al cambiar la topología del árbol.

7. **Toasts Sonner en AabRightPanel y AabTreeView**: ambos usan un estado local `error` mostrado en texto (`AabRightPanel.client.tsx:262`), no Sonner. Viola el patrón del sistema.

8. **Skeleton de carga**: la página muestra texto plano `"Cargando árbol..."` (`page.tsx:246`). No usa `<Skeleton>`.

---

## 2. Modelo de interacción

### Qué representa cada nodo

Un nodo del árbol (`CopyGroupNode`) representa una **cuenta de trading** (`accounts.id`) dentro de un **CopyGroup**. Tiene `role: "master" | "slave"` y `status: "active" | "paused" | "read_only"`. Los links (`CopyGroupLink`) representan la relación parent→child con `copy_multiplier` y `link_type: "solid" | "shadow"`.

**Jerarquía válida**: exactamente 1 master activo por CopyGroup (`copy_group_nodes_master_active` unique index). El master es la raíz. Los slaves son hojas o nodos intermedios. Profundidad máxima: no hay límite en DB, pero en práctica 3-4 niveles es el caso de uso real.

### Semántica de cada operación de drag

#### Operación A — Reorder (mismo parent)
Arrastrar un slave sobre un hermano (mismo parent en el árbol) cambia el `sort_index` visual.
- Endpoint: `PATCH /api/copy-groups/[id]/nodes/reorder` (ya existe).
- Afecta: solo `sort_index`, no modifica links.
- No requiere confirmación.

#### Operación B — Reparent (cambiar parent)
Arrastrar un slave y soltarlo sobre otro nodo (master u otro slave) como nuevo parent.
- Significa: eliminar el link `(oldParent → slave)` y crear `(newParent → slave)`.
- Endpoint: DELETE `link_id` + POST nuevo link (ambos ya existen).
- **REQUIERE** `ConfirmDialog` tipo `warning` porque cambia la topología de mirroring activo.
- El `copy_multiplier` del nuevo link se hereda del link eliminado (default: 1.0 si no tenía).

#### Operación C — Connect orphan
Arrastrar un nodo de la sección "huérfanos" y soltarlo sobre cualquier nodo del árbol.
- Significa: POST nuevo link `(target → orphan)`.
- Endpoint: `POST /api/copy-groups/[id]/links` (ya existe).
- No requiere confirmación (acción constructiva, no destructiva).

#### Operaciones PROHIBIDAS

| Intento | Motivo | Feedback |
|---|---|---|
| Arrastrar el master | El master es la raíz inamovible | Drag bloqueado — handle deshabilitado en `role="master"` |
| Reparent sobre sí mismo | `parent === child` | DB rechaza (`copy_group_links_no_self`), UI previene drop con zona roja |
| Reparent que crea ciclo | A→B→C→A | DB rechaza (`copy_group_links_guard` trigger), UI debe detectarlo client-side antes de intentar (ver sección 5) |
| Drop fuera del árbol (canvas vacío) | Sin destino válido | Cancelar drag sin efecto, nodo vuelve a su posición |
| Reorder del master entre slaves | El master es siempre primero visualmente | Handle deshabilitado |
| Drop de slave sobre sí mismo | Operación nula | Ignorar silenciosamente |

### Detección de ciclos client-side

Antes de confirmar un reparent, se ejecuta `wouldCreateCycle(links, draggedNodeAccountId, targetNodeAccountId)`:

```
function wouldCreateCycle(links, draggedAccountId, newParentAccountId):
  // Si el newParent es descendiente del nodo dragged → ciclo
  visited = {draggedAccountId}
  queue = [draggedAccountId]
  while queue not empty:
    current = queue.pop()
    children = links.filter(l => l.parent_account_id === current).map(l => l.child_account_id)
    for child of children:
      if child === newParentAccountId: return true
      if not visited.has(child):
        visited.add(child)
        queue.push(child)
  return false
```

Si `wouldCreateCycle` devuelve `true`, la drop zone muestra borde rojo y el drop se cancela sin llamar al servidor.

---

## 3. Estados visuales

### Nodo en reposo (idle)
- Borde `border-slate-700`, fondo `bg-slate-900/60`.
- Drag handle: icono `GripVertical` (Lucide) a la izquierda, color `text-slate-600`, visible siempre en nodos slave (invisible en master).
- En mobile: handle ocupa al menos 44×44px área táctil.

### Nodo siendo arrastrado (dragging)
- El nodo original: `opacity-30` + `ring-2 ring-cyan-500/40` (placeholder fantasma).
- El ghost (preview flotante): `opacity-90`, `shadow-2xl`, `scale-105`, `ring-2 ring-cyan-400`, fondo `bg-slate-800`.
- Cursor: `cursor-grabbing` en desktop.

### Drop zone — válida (hover)
Cuando el ghost se cierne sobre un nodo válido como destino de reparent:
- Borde del nodo destino: `border-emerald-400` + `bg-emerald-500/10`.
- Indicador de posición: línea horizontal `border-t-2 border-emerald-400` si es reorder (misma profundidad), o "dent" de inserción si es reparent (hijo).

### Drop zone — inválida (hover)
Cuando el ghost se cierne sobre el propio nodo, el master, o un destino que crearía ciclo:
- Borde: `border-rose-500` + `bg-rose-500/10`.
- Icono `X` (Lucide, size 14) superpuesto en la esquina superior derecha del nodo destino.
- No se muestran mensajes de texto durante el hover (demasiado ruidoso).

### Estado de carga (persisting)
Mientras el `PATCH`/`DELETE`/`POST` resuelve (optimistic → confirming):
- El nodo muestra un spinner `Loader2` (Lucide, `animate-spin`, size 12) en lugar del drag handle.
- `aria-busy="true"` en el elemento.
- Otros nodos: `pointer-events-none` para evitar drag durante la persistencia.

### Optimistic update + rollback
- El árbol se actualiza inmediatamente al soltar (estado local).
- Si la llamada al servidor falla: `toast.error("No se pudo mover el nodo — cambio revertido")` (Sonner) + reverter al estado anterior (snapshot del árbol antes del drag).
- Si tiene éxito: `toast.success("Nodo movido")` + llamar `onReload()` para sincronizar versión.

---

## 4. Touch / Mobile

### Long-press to drag (activationConstraint)
En la configuración del `PointerSensor` (que funciona tanto en mouse como touch):

```ts
useSensor(PointerSensor, {
  activationConstraint: {
    delay: 250,      // ms long-press para activar en touch
    tolerance: 5,    // px — cancelar si se mueve antes del delay
  },
})
```

El `delay: 250` es la clave del comportamiento mobile-first: en touch, un tap rápido sigue siendo una selección del nodo (abre el panel derecho), mientras que mantener presionado 250ms inicia el drag. En mouse no hay delay perceptible porque la distancia mínima (`distance`) es más apropiada — usar `distance: 6` para mouse y `delay` para touch sería ideal, pero `PointerSensor` no discrimina por tipo. La solución: usar el `delay` como activación principal (funciona bien en ambos) o combinar `TouchSensor` + `MouseSensor` por separado.

**Recomendación**: usar `TouchSensor` con `{ delay: 250, tolerance: 5 }` y `MouseSensor` con `{ activationConstraint: { distance: 6 } }` por separado, siguiendo el patrón ya usado en `SortableSlavesList` con `PointerSensor`.

### Área táctil del handle
El `<button>` del drag handle debe tener `min-h-[44px] min-w-[44px]` (o padding equivalente) para cumplir WCAG 2.5.5. En `SortableSlavesList` el handle actual no cumple esto — el nuevo `AabTreeView` debe corregirlo.

### Scroll durante drag
En mobile, el drag debe coexistir con el scroll de la página. `@dnd-kit` maneja esto con `touch-none` en el handle (ya aplicado en `SortableSlavesList.client.tsx:152`). El árbol debe aplicar `overflow-y-auto` en el contenedor y el scroll se activa si el usuario no toca el handle.

### Alternativa de teclado (accesibilidad)
`@dnd-kit/core` incluye `KeyboardSensor` con `sortableKeyboardCoordinates`. El patrón ya está en `SortableSlavesList.client.tsx:53`. Para el árbol jerárquico, los movimientos de teclado deben ser:

| Tecla | Acción |
|---|---|
| `Space` / `Enter` sobre handle | Iniciar/confirmar drag por teclado |
| `ArrowUp` / `ArrowDown` | Mover hacia arriba/abajo (reorder) |
| `ArrowRight` | Intentar hacer hijo del nodo siguiente (reparent) |
| `ArrowLeft` | Subir un nivel (reparent al abuelo) |
| `Escape` | Cancelar drag |

Las flechas Right/Left son no estándar en @dnd-kit — requieren un `coordinateGetter` personalizado. Para MVP, `ArrowUp/Down` para reorder y un botón "Mover a..." en el panel derecho como alternativa accesible al reparent.

### ARIA del árbol

```html
<ul role="tree" aria-label="Árbol de nodos del CopyGroup">
  <li role="treeitem" aria-expanded="true" aria-selected="false">
    <!-- Master node -->
    <ul role="group">
      <li role="treeitem" aria-selected="true">
        <!-- Slave node seleccionado -->
        <button aria-label="Arrastrar para mover" aria-roledescription="sortable">
          <!-- GripVertical handle -->
        </button>
      </li>
    </ul>
  </li>
</ul>
```

- `role="tree"` en el `<ul>` raíz.
- `role="treeitem"` en cada `<li>`.
- `role="group"` en `<ul>` de hijos.
- `aria-expanded` en nodos con hijos (true si expandido).
- `aria-selected` en el nodo seleccionado actualmente.
- `aria-grabbed` (deprecated en ARIA 1.2 — NO usar). En su lugar, @dnd-kit inyecta `aria-roledescription="sortable"` y anuncios de live region automáticamente.
- @dnd-kit incluye `DndContext` con `accessibility.announcements` para anunciar inicio/fin de drag a lectores de pantalla.

---

## 5. Persistencia

### Operación A — Reorder (ya implementado)

```
PATCH /api/copy-groups/[id]/nodes/reorder
Body: { ordered_ids: string[] }
Response: { ok: true, count: number }
```

El endpoint existe (`src/app/api/copy-groups/[id]/nodes/reorder/route.ts`) y es utilizado por `SortableSlavesList`. El `AabTreeView` con DnD puede reutilizarlo.

**Nota**: el endpoint ordena todos los IDs recibidos (no discrimina entre slaves de distintos parents). En un árbol multi-nivel, el reorder dentro de un mismo parent debe enviar solo los IDs de ese subconjunto, ordenados. El endpoint ya maneja esto correctamente porque aplica `sort_index = i` por posición en el array recibido.

### Operación B — Reparent

No existe un endpoint atómico para reparent. Se necesita:

**Opción 1 (sin endpoint nuevo)**: DELETE link viejo + POST link nuevo, secuencial client-side.
- Pros: no requiere trabajo de backend.
- Cons: si el POST falla tras el DELETE, el nodo queda huérfano. Requiere rollback manual o retry UI.

**Opción 2 (endpoint nuevo — recomendado)**:

```
PATCH /api/copy-groups/[id]/links/[linkId]/reparent
Body: { new_parent_account_id: string }
Response: { link: CopyGroupLink }
```

Este endpoint: valida el nuevo parent pertenece al grupo, ejecuta `copy_group_would_create_cycle` en DB, actualiza `parent_account_id` en la fila del link, llama `createSnapshotVersion` y `recordCopyGroupEvent`. Todo atómico.

**Trabajo futuro (marcado)**: el endpoint `PATCH /api/copy-groups/[id]/links/[linkId]/reparent` NO EXISTE. Se debe implementar en la Fase 3 (ver plan). Por ahora, la UI puede usar la Opción 1 con manejo de error explícito.

### Operación C — Connect orphan

```
POST /api/copy-groups/[id]/links
Body: { parent_account_id, child_account_id, copy_multiplier?, link_type? }
Response: CopyGroupLink
```

El endpoint ya existe y valida ciclos en DB trigger.

### Offline (AlphaCore)

Los nodos del árbol NO deben encolarse en el outbox AlphaCore. Las razones:

1. Las operaciones de reparent son topológicamente dependientes del orden. Aplicar un reparent fuera de orden puede resultar en un árbol inconsistente.
2. El Copy Group actúa como configuración de mirroring de trades en tiempo real. Un reparent offline que se drena horas después puede afectar trades que ya ocurrieron.

**Decisión**: si no hay red al intentar un drag, mostrar `toast.error("Sin conexión — los cambios de topología requieren conexión activa")` y revertir el drag inmediatamente. No encolar en outbox.

---

## 6. Recomendación de librería

### Decisión: `@dnd-kit/core` + `@dnd-kit/sortable` (ya instalado)

**Ya está en `package.json`**:
```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

**Ya hay precedente en el proyecto**: `SortableSlavesList.client.tsx` lo usa con el patrón correcto (PointerSensor + KeyboardSensor, optimistic update, rollback, Sonner toast). El nuevo código puede seguir ese patrón exactamente.

### Por qué NO las alternativas

| Librería | Razón de descarte |
|---|---|
| HTML5 native DnD | No funciona en touch sin polyfill adicional. Sin soporte para touch events nativos. Inaceptable para PWA mobile-first. |
| `react-dnd` | Requiere backend DnD específico, API más verbosa, mayor bundle size (~35KB vs ~8KB de @dnd-kit). La comunidad migró mayoritariamente a @dnd-kit. |
| `react-beautiful-dnd` (Atlassian) | Archivado/en mantenimiento mínimo. No compatible con React 19 sin parches. |

### @dnd-kit para árbol jerárquico

`@dnd-kit/sortable` asume listas planas. Para árboles se usa `@dnd-kit/core` directamente con `useDraggable` y `useDroppable` en lugar de `useSortable`. El árbol del AAB tiene dos operaciones distintas (reorder = `useSortable` dentro del mismo nivel; reparent = `useDraggable`+`useDroppable` entre niveles) que requieren lógica personalizada. Esto es el trabajo principal de la Fase 2.

---

## 7. Plan de implementación por fases

### Fase 1 — Higiene de los componentes existentes (esfuerzo: S)

**Objetivo**: corregir deuda antes de agregar DnD. Esto sí se puede hacer sin la spec de DnD.

1. Migrar `AabRightPanel.client.tsx` para usar `toast.error/toast.success` (Sonner) en lugar del estado `error` local mostrado en texto plano (`AabRightPanel.client.tsx:262`). Seguir el patrón de `SortableSlavesList.client.tsx:69`.

2. Reemplazar `confirm()` nativo en `AabRightPanel.client.tsx:207` (`handleRollback`) por `<ConfirmDialog>` de `@/components/ui`. `confirm()` viola el patrón del sistema.

3. Agregar `<Skeleton count={3} />` en `page.tsx:246` reemplazando el texto `"Cargando árbol..."`.

4. Agregar ARIA al árbol existente en `AabTreeView.client.tsx:137`: `role="tree"` en el contenedor, `role="treeitem"` en cada nodo, `aria-selected` en el nodo seleccionado.

5. Corregir `AabRightPanel.client.tsx` para recibir y usar el `csrfToken` en los `fetch()` calls (actualmente ningún fetch en AAB incluye el header `x-csrf-token`). Agregar `headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }` siguiendo el patrón del resto de panels.

**Archivos afectados**: `AabRightPanel.client.tsx`, `AabTreeView.client.tsx`, `page.tsx`.

---

### Fase 2 — DnD de reorder flat de slaves (esfuerzo: M)

**Objetivo**: integrar `SortableSlavesList` directamente dentro de `AabTreeView` para que los slaves hijos de cada nodo sean reordenables por drag.

**Aclaración de alcance**: esta fase es reorder dentro del mismo nivel (hermanos), NO reparent entre niveles.

1. Refactorizar `AabTreeView.client.tsx` para que la lista de hijos de cada nodo sea un `<SortableContext>` con `verticalListSortingStrategy`. Cada `TreeNode.children` es una lista independiente que puede ser reordenada.

2. El `DndContext` raíz envuelve todo el árbol. Cada subgrupo de hijos tiene su propio `SortableContext`.

3. En `onDragEnd`: si `active.data.current.parentId === over.data.current.parentId`, es reorder → PATCH `/nodes/reorder` con los IDs del grupo afectado.

4. Drag handle: `<GripVertical size={14} />` (Lucide) a la izquierda de cada nodo slave. Master: sin handle (o handle deshabilitado visualmente con `opacity-30 cursor-not-allowed`).

5. Estados visuales: `isDragging ? "opacity-30" : ""` en el nodo original, `ring-2 ring-cyan-500` en el nodo fantasma (vía `@dnd-kit/utilities` `CSS.Transform`).

6. Área táctil del handle: `className="touch-none p-3 -m-3"` para hit area 44px sin alterar el layout visual.

**Archivos nuevos/modificados**:
- `src/components/tradehub/aab/AabTreeView.client.tsx` — refactorizar.
- No requiere nuevos endpoints.

---

### Fase 3 — Reparent entre niveles (esfuerzo: L)

**Objetivo**: arrastrar un slave y soltarlo sobre otro nodo para cambiar su parent en el árbol.

1. Implementar el endpoint `PATCH /api/copy-groups/[id]/links/[linkId]/reparent`:
   - Valida `new_parent_account_id` pertenece al grupo.
   - Llama `copy_group_would_create_cycle` en DB antes de actualizar.
   - Actualiza `parent_account_id` en `copy_group_links`.
   - Llama `createSnapshotVersion` + `recordCopyGroupEvent`.
   - Responde con el link actualizado.

2. En `AabTreeView`, cada nodo (master y slave) es un `useDroppable`. Cuando un nodo draggable se cierne sobre un nodo droppable:
   - Calcular si el drop sería reparent (parent diferente) o reorder (mismo parent).
   - Ejecutar `wouldCreateCycle(links, draggedAccountId, targetAccountId)` client-side.
   - Colorear drop zone: verde si válido, rojo si ciclo/inválido.

3. Al soltar en un nodo de distinto parent:
   - Mostrar `<ConfirmDialog variant="warning">` con mensaje: "¿Mover [nombre] como hijo de [nuevo parent]? Esto cambia la topología de mirroring activa."
   - En `onConfirm`: actualizar optimistamente el árbol local, llamar PATCH reparent, en error revertir + toast.
   - En `onCancel`: revertir drag sin cambios.

4. Drop sobre huérfanos: la sección de huérfanos (`AabTreeView.client.tsx:143`) convierte cada item en un `useDraggable`. Al soltar sobre un nodo del árbol, llama `POST /api/copy-groups/[id]/links`.

**Archivos nuevos/modificados**:
- `src/app/api/copy-groups/[id]/links/[linkId]/reparent/route.ts` — nuevo endpoint (trabajo futuro).
- `src/components/tradehub/aab/AabTreeView.client.tsx` — agregar DnD de reparent.

---

### Fase 4 — Visualización enriquecida y accesibilidad completa (esfuerzo: M)

**Objetivo**: mejorar feedback visual y completar accesibilidad.

1. Reemplazar el SVG estático de `CopyGroupGraph.client.tsx` por un SVG animado que refleje en tiempo real los cambios del árbol (las líneas se redibujan al reparentar).

2. Implementar el `coordinateGetter` personalizado para `KeyboardSensor` con soporte de `ArrowRight`/`ArrowLeft` para reparent por teclado.

3. Agregar anuncios de live region (`aria-live="polite"`) para confirmar operaciones de drag a lectores de pantalla, complementando los anuncios automáticos de @dnd-kit.

4. Preview de árbol en el `ConfirmDialog` de reparent: mostrar un mini-árbol "antes/después" con la estructura nueva propuesta.

5. Indicator de "árbol no guardado" si hay cambios pendientes de persistir (en el caso de multi-operación rápida).

**Archivos nuevos/modificados**:
- `src/components/copygroups/CopyGroupGraph.client.tsx` — enriquecer SVG.
- `src/components/tradehub/aab/AabTreeView.client.tsx` — accesibilidad completa.

---

### Resumen de esfuerzo relativo

| Fase | Esfuerzo | Bloquea | Puede paralelizarse con |
|---|---|---|---|
| Fase 1 — Higiene | S (1-2h) | Nada | Cualquier otra tarea |
| Fase 2 — Reorder flat | M (4-6h) | Fase 1 | Fase 3 (endpoint) |
| Fase 3 — Reparent | L (8-12h) | Fase 2 | — |
| Fase 4 — Visual/A11y | M (4-6h) | Fase 3 | — |

Estimaciones en tiempo de desarrollo sin testing. Con tests unitarios: multiplicar por 1.5x.

---

## Apéndice A — Contrato de tipos para DnD

```typescript
// Data attached to draggable nodes via useDraggable / useSortable
interface DraggableNodeData {
  type: "tree-node";
  nodeId: string;         // copy_group_nodes.id
  accountId: string;      // copy_group_nodes.account_id
  parentAccountId: string | null;  // null si es master o huérfano
  role: "master" | "slave";
  depth: number;          // 0 = master, 1 = direct child, etc.
}

// Data attached to droppable zones
interface DroppableZoneData {
  type: "tree-node" | "orphan-zone";
  accountId: string;
  role: "master" | "slave";
}

// Result of a completed drag operation
type DragResult =
  | { kind: "reorder"; nodeIds: string[]; parentAccountId: string }
  | { kind: "reparent"; nodeId: string; oldLinkId: string; newParentAccountId: string }
  | { kind: "connect-orphan"; nodeAccountId: string; parentAccountId: string }
  | { kind: "cancelled" };
```

---

## Apéndice B — Reglas de negocio críticas

1. **1 master activo por grupo**: el master nunca puede ser arrastrado. Si se intenta arrastrar, el drag no se activa (handle disabled).

2. **Solid links: 1 parent por child** (`copy_group_links_solid_parent_unique` index): un slave no puede tener 2 parents solid simultáneamente. En la UI, si el slave ya tiene un link solid y se intenta conectar a un nuevo parent, el reparent reemplaza el link existente (DELETE + POST), no lo duplica.

3. **Shadow links: pueden coexistir múltiples**: un slave puede recibir señales shadow de varios masters simultáneamente. El DnD de reparent aplica solo a solid links.

4. **Anti-ciclo en DB**: la DB rechaza ciclos en solid links con un trigger de `EXCEPTION`. El cliente debe pre-validar y nunca enviar una request que la DB rechazará — la detección client-side en `wouldCreateCycle` es obligatoria, no opcional.

5. **Versionado automático**: cada operación de topología (reparent, connect orphan) debe llamar `createSnapshotVersion` en el servidor. Los endpoints actuales ya lo hacen; el nuevo endpoint de reparent también debe hacerlo.
