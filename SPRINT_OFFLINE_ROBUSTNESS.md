A/B# Sprint: Offline Robustness for Journal/Outbox

**Date**: 2026-01-20  
**Status**: ✅ Completed  
**Objective**: Strengthen offline-first infrastructure for journal mutations with backoff/retry improvements

---

## 🎯 Goals

1. ✅ Add exponential backoff + jitter to outbox sync retries
2. ✅ Surface retry attempt counts in error payload for diagnostics
3. ✅ Fix `retryEntry()` lookup bug (was scanning pending array)
4. ✅ Ensure journal mutations leverage improved outbox behavior

---

## 📝 Changes

### 1. Outbox Sync Config (`src/lib/alphacore/offline/outbox.ts`)

**Added Config Parameters:**
```typescript
export interface OutboxSyncConfig {
  maxRetries?: number;            // Default: 3
  retryDelayMs?: number;          // Default: 1000 (base delay)
  maxBackoffMs?: number;          // Default: 15000 (cap backoff)
  backoffMultiplier?: number;     // Default: 2 (exponential factor)
  jitterRatio?: number;           // Default: 0.25 (25% jitter)
  autoSyncEnabled?: boolean;      // Default: true
  autoSyncIntervalMs?: number;    // Default: 30000 (30s)
}
```

**Example Delays:**
- Attempt 1: 1000ms
- Attempt 2: 2000ms ± 25% jitter
- Attempt 3: 4000ms ± 25% jitter
- Attempt 4+: capped at 15000ms ± 25% jitter

### 2. Retry Logic (`syncEntryWithBackoff()`)

**New Private Method:**
```typescript
private async syncEntryWithBackoff(entry: IDBOutboxEntry, maxAttempts: number) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await this.syncEntry(entry);
      if (attempt > 1) {
        console.log(`[OutboxManager] Entry ${entry.id} succeeded after ${attempt} attempts`);
      }
      return { success: true as const, attempts: attempt, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[OutboxManager] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

      const hasAttemptsLeft = attempt < maxAttempts;
      if (!hasAttemptsLeft) break;

      const delay = this.getRetryDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { success: false as const, attempts: maxAttempts, error: lastError };
}
```

### 3. Backoff Calculation (`getRetryDelay()`)

**Exponential with Jitter:**
```typescript
private getRetryDelay(attempt: number): number {
  const exponential = this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, Math.max(0, attempt - 1));
  const capped = Math.min(exponential, this.config.maxBackoffMs);
  const jitter = capped * this.config.jitterRatio;
  const min = capped - jitter;
  const max = capped + jitter;
  return Math.max(0, Math.random() * (max - min) + min);
}
```

### 4. Fixed `retryEntry()` Lookup Bug

**Before:**
```typescript
const entry = await getPendingOutboxEntries();
const target = entry.find((e) => e.id === entryId);
```

**After:**
```typescript
const entry = await getOutboxEntry(entryId);
```

Now correctly retrieves the specific entry (including failed ones, not just pending).

### 5. Updated `syncAll()` Error Tracking

**Before:**
```typescript
result.errors.push({
  entryId: entry.id,
  error: errorMsg,
  retryCount: entry.retryCount + 1,
});
```

**After:**
```typescript
result.errors.push({
  entryId: entry.id,
  error: errorMsg,
  retryCount: attempts, // Actual attempt count from backoff loop
});
```

---

## 🧪 Testing

```bash
# Lint check
npm run lint -- src/lib/alphacore/offline/outbox.ts
✅ No errors

# Build verification
npm run build
✅ Compiled successfully
```

---

## 📊 Impact on Journal Mutations

Journal mutations in `src/lib/alphacore/journal.ts` automatically benefit from these improvements:

- `createJournalEntry()` → uses `mutateOfflineFirst()` → leverages `OutboxManager`
- `updateJournalEntry()` → uses `mutateOfflineFirst()` → leverages `OutboxManager`
- `deleteJournalEntry()` → uses `mutateOfflineFirst()` → leverages `OutboxManager`

When offline:
1. Entry enqueued to outbox with new config defaults
2. On reconnect, `syncAll()` triggers with exponential backoff
3. Failed entries tracked with attempt counts for UI diagnostics

---

## 🔄 Rollback

```bash
git revert d63b000
# or
git restore src/lib/alphacore/offline/outbox.ts
```

---

## 📋 Next Steps

### Phase 1: UI Diagnostics (Optional)
- [ ] Surface `OutboxStats` in SystemDiagnostics widget
- [ ] Display failed/conflict entries with retry counts
- [ ] Add manual "Retry Failed" button

### Phase 2: Performance (Optional)
- [ ] Cap total `syncAll()` duration to avoid blocking
- [ ] Yield between entries in large queues
- [ ] Add telemetry for retry success rates

### Phase 3: Conflict Resolution (Backlog)
- [ ] Implement `resolveConflict()` for manual merge
- [ ] Add UI for conflict resolution workflow

---

## 📦 Files Changed

- `src/lib/alphacore/offline/outbox.ts` (+101 lines, -35 lines)

**Commit**: `d63b000`  
**Branch**: `main`  
**Pushed**: ✅ Ready to push

---

## ✅ Checklist

- [x] Exponential backoff implemented with configurable parameters
- [x] Jitter added to prevent thundering herd
- [x] Retry attempt counts tracked in error payload
- [x] `retryEntry()` bug fixed (correct entry lookup)
- [x] Unused imports removed (MutationStatus, ErrorDetail)
- [x] ESLint passes with no warnings
- [x] Build succeeds
- [x] Commit message follows conventional format
- [x] Changes documented in this file
- [x] Rollback instructions provided
- [x] Next steps identified

---

**Summary**: Outbox sync now retries with exponential backoff (1s → 2s → 4s → capped at 15s) + jitter, improving resilience for offline-first journal mutations. Failed entries track attempt counts for future UI diagnostics.
