# SPRINT 3.3 SUMMARY — Attachments Multi-Upload Feature

**Sprint**: 3.3  
**Duration**: 1 sprint  
**Status**: ✅ COMPLETED  
**Build**: ✅ TypeScript OK, 12 routes compiled (Turbopack 2.2s)

---

## Overview

Implemented **multi-file attachment upload** for logs with private bucket storage, signed URLs, image previews, and soft-delete metadata. All files stored in private `log_attachments` bucket with RLS enforcement.

**Key Metrics**:
- 2 new Client Components
- 1 new API route (`/api/attachments`)
- 1 updated component (LogEditor integration)
- ~650 lines of TypeScript
- Zero new dependencies

---

## Files Created/Modified

| File | Type | LOC | Purpose |
|------|------|-----|---------|
| [src/app/api/attachments/route.ts](src/app/api/attachments/route.ts) | API | 260 | POST (upload metadata), GET (list + signed URLs), DELETE (soft-delete) |
| [src/components/logs/AttachmentsUploader.client.tsx](src/components/logs/AttachmentsUploader.client.tsx) | Component | 170 | File input, validation (100MB, .exe/.bat block), upload to storage |
| [src/components/logs/AttachmentsList.client.tsx](src/components/logs/AttachmentsList.client.tsx) | Component | 220 | List attachments, image previews, delete confirmation |
| [src/components/logs/LogEditor.client.tsx](src/components/logs/LogEditor.client.tsx) | Component | +12 lines | Imported AttachmentsUploader + AttachmentsList, conditional render for edits |

**Total New Code**: ~650 lines

---

## Architecture

### 1. Client-Side Validation (`AttachmentsUploader`)

```typescript
validateFile(file: File): string | null
  ├─ Check: file.size ≤ 100MB
  ├─ Block: .exe, .bat (case-insensitive)
  └─ Return: error message if invalid, null if valid
```

**Blocked Extensions** (configurable in component):
```typescript
const BLOCKED_EXTENSIONS = [".exe", ".bat"];
```

**Max File Size**:
```typescript
const MAX_FILE_MB = 100;
```

### 2. Upload Flow

```
1. User selects file(s) via <input type="file" multiple />
2. Validate each file (size + extension)
3. For each valid file:
   a. Generate unique path: `${userId}/${logId}/${randomUUID()}_${safeName}`
   b. Upload to Supabase Storage (log_attachments bucket)
   c. POST /api/attachments to create metadata (user_id, log_id, path, filename, mime_type, size_bytes)
4. On success: Trigger refresh (AttachmentsList refetches)
5. On error: Show message, don't break UI
```

### 3. API Endpoints

#### POST `/api/attachments`
Creates metadata after file uploaded to storage.

**Request**:
```json
{
  "logId": "uuid",
  "filename": "report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1024000,
  "path": "user-id/log-id/uuid_report.pdf"
}
```

**Response** (201):
```json
{
  "id": "attachment-uuid",
  "path": "user-id/log-id/uuid_report.pdf",
  "signedUrl": "https://..."
}
```

**Errors**:
- `400`: Missing required fields (logId, filename, path)
- `401`: Unauthorized (no session)
- `404`: Log not found or unauthorized
- `500`: Database error

#### GET `/api/attachments?logId=xxx`
Fetch all active attachments for a log with signed URLs (60-second expiry).

**Response** (200):
```json
[
  {
    "id": "attachment-uuid",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1024000,
    "signedUrl": "https://...",
    "path": "user-id/log-id/uuid_report.pdf"
  }
]
```

**Filters**:
- `deleted_at IS NULL` (only active attachments)
- `log_id = ?` AND `user_id = ?` (RLS)

#### DELETE `/api/attachments?attachmentId=xxx`
Soft-delete attachment metadata + attempt hard-delete from storage.

**Response** (200):
```json
{
  "success": true
}
```

**Process**:
1. Verify attachment belongs to user
2. Set `deleted_at = now()` (soft-delete metadata)
3. Try `storage.remove([path])` (hard-delete file, non-blocking if fails)
4. Return success (metadata already soft-deleted, user doesn't see attachment)

---

## Component Details

### AttachmentsUploader.client.tsx

**Props**:
```typescript
{
  logId: string;           // Parent log UUID
  onUploadSuccess?: () => void;  // Callback to refresh list
}
```

**Features**:
- Drag-and-drop-ready (shows "Haz clic o arrastra archivos")
- Multi-file select
- Validation: size (≤100MB) + extension (.exe, .bat blocked)
- Error messages in ES
- Upload progress tracking
- Disabled state while uploading

**Validation Errors** (shown in red box):
```
El archivo "script.exe" no está permitido (extensión: .exe)
El archivo "bigfile.zip" excede 100MB (150.5MB)
```

### AttachmentsList.client.tsx

**Props**:
```typescript
{
  logId: string;              // Parent log UUID
  refreshTrigger?: number;    // Increment to refetch
}
```

**Features**:
- Lists active (non-deleted) attachments
- Image previews (jpg/png/webp/gif)
- Linked downloads (signed URLs)
- File size formatting (B, KB, MB, GB)
- Delete with 2-step confirmation:
  1. Click 🗑️ → shows "Confirmar" + "Cancelar"
  2. Click "Confirmar" → soft-delete + remove from list
- Error handling (doesn't break on delete failure)

**Image Preview**:
- MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Shows thumbnail (max 150px height)
- Clickable for full-size view (signed URL)

**Non-Image Files**:
- Shows 📎 icon + filename (linked)
- Signed URL download on click

### LogEditor Integration

**Changes**:
```tsx
// Added imports
import AttachmentsUploader from "./AttachmentsUploader.client";
import AttachmentsList from "./AttachmentsList.client";

// New state
const [attachmentRefresh, setAttachmentRefresh] = useState(0);

// Conditional render (edit mode only, not for new logs)
{log && (
  <>
    <AttachmentsUploader
      logId={log.id}
      onUploadSuccess={() => setAttachmentRefresh((prev) => prev + 1)}
    />
    <AttachmentsList logId={log.id} refreshTrigger={attachmentRefresh} />
  </>
)}
```

**Why only for edits?**:
- New logs don't have an ID yet (can't upload attachments to non-existent log)
- After log created, user can edit it and add attachments then

---

## Security

### Storage Bucket (Private)

**Setup** (manual, one-time):
```sql
-- Supabase Dashboard → Storage Buckets
-- Create: log_attachments
-- Public: OFF (private bucket)
-- File size limit: None (uses per-file 100MB limit in validation)
```

### RLS Policy (Database Level)

```sql
-- Applied automatically via 002_logs_schema.sql trigger
-- Users can only see their own attachments (user_id check)
-- Path-based filtering: storage.url_authenticated_read("log_attachments", ...)
```

### Upload Validation

**Client-Side**:
- Extension check: `.exe`, `.bat` → error (before upload)
- Size check: > 100MB → error (before upload)
- Prevents accidental malware uploads

**Server-Side** (`/api/attachments` POST):
- Auth check: `auth.uid()` required
- Log ownership: Verify `logs.user_id = auth.uid()`
- Path validation: Ensure path matches expected format

### Signed URLs

**Expiry**: 60 seconds (short-lived, prevents URL sharing)
**Usage**: Each attachment fetch regenerates URL
**Privacy**: Private bucket requires signed URL (can't access without it)

---

## Database Schema (Already in 002_logs_schema.sql)

### log_attachments Table

```sql
CREATE TABLE public.log_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  path text NOT NULL UNIQUE,  -- storage path
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz NULL,
  UNIQUE(log_id, path)
);

-- Indexes
CREATE INDEX log_attachments_log_id_idx ON public.log_attachments(log_id)
  WHERE deleted_at IS NULL;
CREATE INDEX log_attachments_user_id_idx ON public.log_attachments(user_id)
  WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.log_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.log_attachments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner_insert" ON public.log_attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update" ON public.log_attachments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "owner_delete" ON public.log_attachments
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger (updated_at)
CREATE TRIGGER log_attachments_updated_at
  BEFORE UPDATE ON public.log_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Testing Checklist

### Setup
- [ ] Supabase project has `log_attachments` bucket (private)
- [ ] Migration 002_logs_schema.sql applied
- [ ] `npm run dev` running

### Upload (Basic)
- [ ] Open /dashboard/logs → edit existing log
- [ ] See "📎 Adjuntos" section with uploader
- [ ] Click uploader, select 1 PDF file
- [ ] File uploads, appears in list below
- [ ] List shows: 📎 filename + size + 🗑️ button

### Upload (Multiple)
- [ ] Select 3 files at once (mix of types: pdf, png, docx)
- [ ] All upload successfully
- [ ] All appear in list
- [ ] List is ordered by creation time (oldest first)

### Validation (Size)
- [ ] Try to upload file > 100MB
- [ ] Error: "El archivo 'bigfile.iso' excede 100MB (250.0MB)"
- [ ] File NOT uploaded

### Validation (Extension)
- [ ] Try to upload .exe file
- [ ] Error: "El archivo 'virus.exe' no está permitido (extensión: .exe)"
- [ ] Try .bat file
- [ ] Error: "El archivo 'script.bat' no está permitido (extensión: .bat)"
- [ ] Try .EXE (uppercase)
- [ ] Error: (case-insensitive check works)

### Image Preview
- [ ] Upload PNG image
- [ ] List shows 🖼️ filename + thumbnail preview (max 150px)
- [ ] Click image → opens in new tab (signed URL)
- [ ] Try JPEG, WebP, GIF
- [ ] All show previews

### Non-Image Download
- [ ] Upload PDF, DOCX, ZIP
- [ ] List shows 📎 filename (no preview)
- [ ] Click filename → downloads file (signed URL)
- [ ] File is same as original (bytes match)

### Delete Confirmation
- [ ] Click 🗑️ on any attachment
- [ ] Button changes to: "Confirmar" (red) + "Cancelar" (gray)
- [ ] Click "Cancelar" → button returns to 🗑️
- [ ] Click 🗑️ again, then "Confirmar"
- [ ] Attachment disappears from list
- [ ] Refresh page (close + reopen edit modal)
- [ ] Attachment NOT in list (soft-deleted, not visible)

### Signed URL Expiry
- [ ] Open attachment in new tab (signed URL)
- [ ] Works immediately
- [ ] Wait 60+ seconds
- [ ] Try to access in new tab
- [ ] Expected: 403 Forbidden or expired message (URL no longer valid)

### RLS (Private Bucket)
- [ ] Try to access attachment path directly (without signed URL)
- [ ] Expected: 403 Forbidden (private bucket, no auth)
- [ ] Try to access other user's attachment (fake URL)
- [ ] Expected: 401/403 (not your attachment)

### Performance
- [ ] Upload 10+ files
- [ ] No lag in UI
- [ ] List renders smoothly
- [ ] Scroll attachment list smoothly

### Error Handling
- [ ] Simulate offline mode
- [ ] Try to upload → error message "Error: Network request failed"
- [ ] Go back online, retry
- [ ] Should work

---

## Rollback Instructions

### If issues arise:

```bash
# Revert to Sprint 3.2 state
git log --oneline | head -20  # Find Sprint 3.3 commit
git revert <commit-hash>  # OR
git reset --hard <previous-commit>

# Revert file changes
git restore src/components/logs/LogEditor.client.tsx

# Delete new files
rm src/app/api/attachments/route.ts
rm src/components/logs/AttachmentsUploader.client.tsx
rm src/components/logs/AttachmentsList.client.tsx

# Rebuild
npm run build
```

### Database (keep schema, disable feature)

Migration 002_logs_schema.sql already includes `log_attachments` table. To fully disable:
1. Keep table (allows reverting and re-enabling)
2. Just don't render AttachmentsUploader/List components in LogEditor
3. Data remains in `log_attachments` table (can restore later)

---

## Configuration

**Editable Constants** (in components):

### AttachmentsUploader.client.tsx
```typescript
const MAX_FILE_MB = 100;  // Change to increase/decrease
const BLOCKED_EXTENSIONS = [".exe", ".bat"];  // Add more as needed
const BUCKET_NAME = "log_attachments";  // Must match Supabase bucket name
```

### API Route
```typescript
const MAX_FILE_MB = 100;  // Matches client
const BLOCKED_EXTENSIONS = [".exe", ".bat"];  // Matches client
const BUCKET_NAME = "log_attachments";  // Must match Supabase bucket name
```

---

## Known Limitations & Future Work

1. **Virus Scanning**: No antivirus scan on upload (enterprise feature)
   - Mitigation: Block executable extensions (.exe, .bat, etc.)

2. **Large File Upload**: No chunking/resumable upload
   - Current: Single request per file (works up to 100MB)
   - Future: Implement TUS protocol for multi-part upload if > 100MB needed

3. **Attachment Sharing**: No public share links
   - Current: Signed URLs (private, requires logged-in to view)
   - Future: Add "share with expiry" option

4. **Bulk Delete**: No bulk delete UI
   - Current: Delete one at a time
   - Future: Checkboxes + bulk delete button

5. **Drag-and-Drop**: UI ready but no drag event handlers
   - Current: Click to select files
   - Future: Full drag-and-drop to modal

6. **Storage Quota**: No quota enforcement
   - Current: Only per-file 100MB limit
   - Future: Add user-level storage quota (e.g., 5GB per account)

---

## Deployment Checklist

Before deploying to production:

- [ ] Create `log_attachments` bucket in Supabase (private)
- [ ] Verify RLS policies on `log_attachments` table
- [ ] Test with real Supabase project credentials
- [ ] Upload test files (verify signed URLs work)
- [ ] Test delete + confirm (metadata soft-deleted, file removed from storage)
- [ ] Monitor Supabase Storage usage in Dashboard
- [ ] Set storage bucket size limit (optional, in Supabase Dashboard)

---

## Build Output

```
✓ Next.js 16.1.1 (Turbopack)
✓ Compiled successfully in 2.2s
✓ TypeScript: passed
✓ Routes (12 total):
  - / (Dynamic)
  - /_not-found (Static)
  - /api/attachments (Dynamic) ← NEW
  - /api/categories (Dynamic)
  - /api/health (Dynamic)
  - /api/logs (Dynamic)
  - /api/tags (Dynamic)
  - /auth (Static)
  - /auth/callback (Dynamic)
  - /dashboard/logs (Dynamic)
  - /manifest.webmanifest (Static)
✓ Proxy (Middleware) enabled
```

---

## Summary

**Sprint 3.3 Objective**: ✅ COMPLETE

- ✅ Multi-file upload to private bucket (up to 100MB each)
- ✅ Validation: .exe/.bat blocked, size enforced
- ✅ Signed URLs (60-second expiry)
- ✅ Image previews (jpg/png/webp/gif)
- ✅ Delete with confirmation (soft-delete metadata, hard-delete file)
- ✅ RLS enforced (user-only access)
- ✅ Integrated in LogEditor (edit mode only)
- ✅ Zero new dependencies
- ✅ Build validated (TypeScript OK, 12 routes)

**Ready for**: QA testing, then deployment to staging/production

**Next Sprint**: (e.g., attachment sharing, bulk operations, search by attachment filename)

---

**Document Version**: 1.0  
**Created**: 2026-01-17  
**Status**: READY FOR QA
