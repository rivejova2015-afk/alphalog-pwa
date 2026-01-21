# SPRINT 3.3 TESTING GUIDE — Attachments Multi-Upload

**Purpose**: Step-by-step manual QA for attachment upload, preview, and delete features  
**Estimated Time**: 1-2 hours  
**Prerequisites**:
- Supabase project with `log_attachments` bucket (private, created manually)
- Migration 002_logs_schema.sql applied
- Sprint 3.2 tests passing (Logs CRUD working)
- `npm run dev` running

---

## Setup

### 1. Create Private Bucket (One-Time)

Navigate to **Supabase Dashboard → Storage → Buckets**

1. Click **"Create bucket"**
2. Enter name: `log_attachments`
3. Toggle **"Public bucket"** OFF (private)
4. Click **Create**

**Expected**: Bucket appears in list with 🔒 icon

### 2. Verify Migration

```bash
# In Supabase Dashboard → SQL Editor, run:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'log_attachments';
-- Expected: 1 row (log_attachments table exists)

-- Check RLS:
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'log_attachments';
-- Expected: rowsecurity = true
```

### 3. Verify Server Running

```bash
curl http://localhost:3000/api/health
# Expected: { "status": "ok" }
```

---

## Test Suite

### GROUP 1: UI & Integration

#### Test 1.1: AttachmentsUploader visible in edit mode (NOT in new log)
- [ ] Navigate to /dashboard/logs
- [ ] Click "+ Nuevo Log", fill fields, click "Crear"
- [ ] Log created
- [ ] Click "Editar" on new log
- [ ] Modal opens
- [ ] Expected: "📎 Adjuntos (máx 100MB c/u)" section visible
- [ ] Expected: "Haz clic o arrastra archivos" uploader visible
- [ ] Expected: "Sin adjuntos" message below

#### Test 1.2: AttachmentsUploader NOT in create mode
- [ ] Click "+ Nuevo Log"
- [ ] Fill fields (don't submit yet)
- [ ] Expected: NO "📎 Adjuntos" section
- [ ] Expected: Only Title, Notes, Type, Category, Tags visible
- [ ] Click "Cancelar"

#### Test 1.3: Multiple logs have separate attachment lists
- [ ] Create log #1 "Log A"
- [ ] Create log #2 "Log B"
- [ ] Edit Log A, upload file "report_a.pdf"
- [ ] Close modal
- [ ] Edit Log B, upload file "report_b.pdf"
- [ ] Close modal
- [ ] Edit Log A again
- [ ] Expected: Shows only "report_a.pdf" (not report_b.pdf)
- [ ] Close, edit Log B
- [ ] Expected: Shows only "report_b.pdf"

---

### GROUP 2: Upload Validation

#### Test 2.1: Valid file upload (PDF)
- [ ] Edit log
- [ ] Click "📤 Haz clic o arrastra archivos"
- [ ] Select a PDF file (e.g., 5MB)
- [ ] Expected: File disappears from input, "Subiendo..." shows briefly
- [ ] Expected: File appears in list below:
  - "📎 filename.pdf"
  - "5.0 MB"
  - "🗑️" button
- [ ] Expected: No error message

#### Test 2.2: Multiple file upload at once
- [ ] Edit log
- [ ] Select 3 files: document.pdf, image.png, spreadsheet.xlsx
- [ ] Expected: "Subiendo 3 archivo(s)..." message
- [ ] Expected: All 3 appear in list (in order of upload)
- [ ] Expected: No errors

#### Test 2.3: File size validation - BLOCKED (> 100MB)
- [ ] Create a test file > 100MB (e.g., generate 150MB dummy file):
  ```bash
  # On Windows PowerShell:
  $file = [System.IO.File]::Create("C:\Users\rivej\Desktop\bigfile_150mb.bin")
  $file.SetLength([long]150*1024*1024)
  $file.Close()
  ```
- [ ] Edit log
- [ ] Try to upload bigfile_150mb.bin
- [ ] Expected: Red error box appears:
  - "El archivo 'bigfile_150mb.bin' excede 100MB (150.0MB)"
- [ ] Expected: File NOT uploaded, NOT in list
- [ ] Expected: File input value cleared (can try again)

#### Test 2.4: Extension validation - BLOCKED (.exe)
- [ ] Create dummy .exe file:
  ```bash
  echo "fake" > C:\Users\rivej\Desktop\virus.exe
  ```
- [ ] Edit log
- [ ] Try to upload virus.exe
- [ ] Expected: Red error box:
  - "El archivo 'virus.exe' no está permitido (extensión: .exe)"
- [ ] Expected: File NOT uploaded, NOT in list

#### Test 2.5: Extension validation - BLOCKED (.bat)
- [ ] Create dummy .bat file:
  ```bash
  echo "echo hello" > C:\Users\rivej\Desktop\script.bat
  ```
- [ ] Edit log
- [ ] Try to upload script.bat
- [ ] Expected: Red error box:
  - "El archivo 'script.bat' no está permitido (extensión: .bat)"
- [ ] Expected: File NOT uploaded, NOT in list

#### Test 2.6: Extension case-insensitive check
- [ ] Try .EXE (uppercase)
- [ ] Expected: Blocked with same message
- [ ] Try .ExE (mixed case)
- [ ] Expected: Blocked

#### Test 2.7: Mixed valid + invalid files
- [ ] Select: document.pdf (5MB) + virus.exe + image.png
- [ ] Expected: Error message appears with ALL blocked files listed:
  - "El archivo 'virus.exe' no está permitido (extensión: .exe)"
- [ ] Expected: NONE of the files uploaded (safe failure)
- [ ] Expected: Can retry after removing bad file

#### Test 2.8: File size at exactly 100MB boundary
- [ ] Create file exactly 100MB (104857600 bytes):
  ```bash
  $file = [System.IO.File]::Create("C:\Users\rivej\Desktop\exactly100mb.bin")
  $file.SetLength([long]100*1024*1024)
  $file.Close()
  ```
- [ ] Edit log
- [ ] Upload exactly100mb.bin
- [ ] Expected: Upload succeeds (100MB is allowed)
- [ ] Expected: File appears in list

#### Test 2.9: File size just over 100MB
- [ ] Create file 100.1MB:
  ```bash
  $file = [System.IO.File]::Create("C:\Users\rivej\Desktop\over100mb.bin")
  $file.SetLength([long]100.1*1024*1024)
  $file.Close()
  ```
- [ ] Edit log
- [ ] Upload over100mb.bin
- [ ] Expected: Error "excede 100MB (100.1MB)"
- [ ] Expected: File NOT uploaded

---

### GROUP 3: File Upload to Storage

#### Test 3.1: File actually stored in Supabase
- [ ] Edit log, upload "report.pdf"
- [ ] Open Supabase Dashboard → Storage → log_attachments
- [ ] Expected: Folder structure visible:
  ```
  log_attachments/
  └── [USER_ID]/
      └── [LOG_ID]/
          └── [UUID]_report.pdf
  ```
- [ ] Expected: File exists, file size matches uploaded

#### Test 3.2: Path follows format: userId/logId/uuid_filename
- [ ] Upload file "test.txt"
- [ ] In Supabase Storage, inspect path:
- [ ] Expected: Path contains your user ID (not hardcoded)
- [ ] Expected: Path contains log ID
- [ ] Expected: UUID-like pattern before filename
- [ ] Expected: Filename preserved at end

#### Test 3.3: Metadata stored in database
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run query:
  ```sql
  SELECT id, filename, mime_type, size_bytes, deleted_at
  FROM public.log_attachments
  WHERE filename = 'report.pdf'
  ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] Expected: 1 row with:
  - filename: "report.pdf"
  - mime_type: "application/pdf"
  - size_bytes: (actual file size)
  - deleted_at: NULL (active)

---

### GROUP 4: Image Preview & Download

#### Test 4.1: Image file with preview (PNG)
- [ ] Upload PNG image (e.g., 200x200px)
- [ ] In list, expected to see:
  - "🖼️ filename.png"
  - Thumbnail preview (≤ 150px height)
  - Thumbnail clickable (opens in new tab with signed URL)
- [ ] Click thumbnail
- [ ] Expected: New tab opens showing full-size image
- [ ] Expected: Image displays correctly

#### Test 4.2: Image file with preview (JPEG)
- [ ] Upload JPEG image
- [ ] Expected: 🖼️ icon + thumbnail preview
- [ ] Click thumbnail
- [ ] Expected: Opens correctly

#### Test 4.3: Image file with preview (WebP)
- [ ] If you have a WebP image, upload it
- [ ] Expected: 🖼️ icon + preview

#### Test 4.4: Image file with preview (GIF)
- [ ] Upload GIF file
- [ ] Expected: 🖼️ icon + preview (shows first frame or animated)
- [ ] Click thumbnail
- [ ] Expected: Opens in new tab

#### Test 4.5: Non-image file shows link only (PDF)
- [ ] Upload PDF
- [ ] In list, expected to see:
  - "📎 report.pdf"
  - Size (e.g., "5.0 MB")
  - NO preview/thumbnail
  - 🗑️ button
- [ ] Filename is clickable link
- [ ] Click filename
- [ ] Expected: Downloads PDF (or opens in browser if PDF viewer available)

#### Test 4.6: Non-image file shows link only (DOCX)
- [ ] Upload DOCX file
- [ ] Expected: 📎 icon + link
- [ ] Expected: No preview
- [ ] Click link
- [ ] Expected: Downloads file

#### Test 4.7: Non-image file shows link only (ZIP)
- [ ] Upload ZIP archive
- [ ] Expected: 📎 icon + link
- [ ] Click link
- [ ] Expected: Downloads ZIP

#### Test 4.8: File size formatting
- [ ] Upload various sizes:
  - 500 bytes → shows "500 B"
  - 5 KB → shows "5.0 KB"
  - 1.5 MB → shows "1.5 MB"
  - 100 MB → shows "100.0 MB"
- [ ] Expected: Correct formatting for all sizes

#### Test 4.9: Signed URL is valid (has token)
- [ ] Open DevTools → Network tab
- [ ] Click on image thumbnail or file link
- [ ] In Network, click request → inspect URL
- [ ] Expected: URL contains query params (e.g., `token=...`, `expires_at=...`)
- [ ] Expected: URL is from `supabase.co` domain

---

### GROUP 5: Delete Confirmation & Soft-Delete

#### Test 5.1: Delete button shows 🗑️
- [ ] Upload any file
- [ ] In attachment list item, expected to see 🗑️ button on right

#### Test 5.2: Click 🗑️ shows confirmation
- [ ] Click 🗑️ button
- [ ] Expected: 🗑️ button replaced with:
  - "Confirmar" button (red)
  - "Cancelar" button (gray)

#### Test 5.3: Click "Cancelar" reverts to delete icon
- [ ] With "Confirmar" + "Cancelar" showing
- [ ] Click "Cancelar"
- [ ] Expected: Back to 🗑️ button
- [ ] Expected: Attachment still in list

#### Test 5.4: Click "Confirmar" deletes attachment from UI
- [ ] Click 🗑️
- [ ] Click "Confirmar"
- [ ] Expected: "Confirmar" button shows "..." (loading state)
- [ ] Expected: After 1-2s, attachment disappears from list
- [ ] Expected: "Sin adjuntos" message appears if no more attachments

#### Test 5.5: Deleted attachment doesn't reappear on refresh
- [ ] Delete attachment
- [ ] Close modal (click Cancelar or outside)
- [ ] Edit same log again
- [ ] Expected: Deleted attachment NOT in list
- [ ] Expected: Soft-delete persisted to database

#### Test 5.6: Soft-delete in database
- [ ] Delete file from UI
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run:
  ```sql
  SELECT deleted_at FROM public.log_attachments
  WHERE filename = 'deleted_file.pdf'
  ORDER BY deleted_at DESC LIMIT 1;
  ```
- [ ] Expected: deleted_at is NOT NULL (timestamp shown)
- [ ] Expected: Not filtering by "deleted_at IS NULL" shows it

#### Test 5.7: File deleted from storage
- [ ] Upload "temp_file.txt"
- [ ] Delete from UI
- [ ] Open Supabase Dashboard → Storage → log_attachments
- [ ] Check userId/logId/ folder
- [ ] Expected: File NOT visible in storage (hard-deleted)

#### Test 5.8: Multiple attachments - delete one
- [ ] Upload 3 files: file1.pdf, file2.txt, file3.png
- [ ] Delete file2.txt
- [ ] Expected: Only file1.pdf + file3.png remain in list
- [ ] Expected: file2.txt gone from storage

#### Test 5.9: Delete failure (network error) doesn't break UI
- [ ] Open DevTools → Network → Offline
- [ ] Upload file
- [ ] Try to delete
- [ ] Expected: Error message appears
- [ ] Expected: UI doesn't crash
- [ ] Go back online, retry
- [ ] Expected: Delete succeeds or retries work

---

### GROUP 6: Signed URL Expiry

#### Test 6.1: Signed URL expires after 60 seconds
- [ ] Upload image
- [ ] Click thumbnail to get signed URL
- [ ] New tab opens, image displays
- [ ] Note the URL from address bar
- [ ] Wait 60+ seconds
- [ ] Refresh the tab with signed URL
- [ ] Expected: Image fails to load (403 Forbidden or "Access Denied")
- [ ] Go back to main Logs tab
- [ ] Close + reopen edit modal
- [ ] Click thumbnail again (new signed URL generated)
- [ ] Expected: New URL works

#### Test 6.2: Each fetch generates fresh signed URL
- [ ] Upload file
- [ ] Click link → note URL token
- [ ] Close browser tab
- [ ] Click link again in modal
- [ ] Expected: New URL has different token
- [ ] Expected: Both downloads work

---

### GROUP 7: RLS & Security

#### Test 7.1: Private bucket - no direct access without signed URL
- [ ] Open Supabase Dashboard → Storage → log_attachments
- [ ] Right-click on file → Copy Path or Get URL
- [ ] Try to access directly in browser (without signed URL)
- [ ] Expected: 403 Forbidden or "No such object"
- [ ] Expected: Can't access without authentication

#### Test 7.2: Can't access other user's attachments
- [ ] (Requires 2 test accounts)
- [ ] Account A: Create log, upload file
- [ ] Account B: Log in
- [ ] Account B: Try to guess URL format of Account A's file
- [ ] Expected: 401/403 (RLS prevents access)

#### Test 7.3: Attachments only visible to log owner
- [ ] Account A: Create log "Secret Log", upload "secret.pdf"
- [ ] API: GET /api/attachments?logId=[SECRET_LOG_ID]
- [ ] Expected: Returns attachment (you own it)
- [ ] Account B: GET same endpoint with Account A's logId
- [ ] Expected: Error (401 Unauthorized, RLS blocks)

---

### GROUP 8: Performance & Stress

#### Test 8.1: Upload large file (near 100MB limit)
- [ ] Create 99MB file
- [ ] Upload to log
- [ ] Expected: Takes few seconds
- [ ] Expected: No timeout, completes successfully
- [ ] File appears in list with "99.0 MB" size

#### Test 8.2: Multiple attachments performance
- [ ] Upload 20+ files (all < 100MB)
- [ ] Expected: UI remains responsive
- [ ] Expected: Can scroll list smoothly
- [ ] Expected: Delete/upload actions don't lag

#### Test 8.3: List with many attachments
- [ ] Ensure log has 50+ attachments
- [ ] Open edit modal
- [ ] Expected: List loads in < 3 seconds
- [ ] Expected: All 50+ show correctly
- [ ] Expected: Scrolling smooth

#### Test 8.4: Concurrent uploads (if UI supports it)
- [ ] Select 5 files
- [ ] All upload at once (or user triggers)
- [ ] Expected: All complete successfully
- [ ] Expected: No conflicts or errors

---

### GROUP 9: Edge Cases

#### Test 9.1: File with special characters in name
- [ ] Upload file named: "report_2026-01-17_draft (v2).pdf"
- [ ] Expected: Filename preserved in list
- [ ] Expected: Metadata saved correctly
- [ ] Expected: Link/download works

#### Test 9.2: File with no extension
- [ ] Create file "README" (no extension)
- [ ] Upload
- [ ] Expected: Accepted (only .exe/.bat blocked)
- [ ] Expected: Shows in list

#### Test 9.3: File with .exe in middle of name
- [ ] File "my.exe.pdf" (double extension, PDF is real)
- [ ] Upload
- [ ] Expected: Blocked (extension = .pdf, not .exe, should be allowed)
- [ ] Actually, let me clarify: filename "script.exe.pdf"
- [ ] Last extension is .pdf → allowed
- [ ] Test confirms: Last extension (.pdf) is checked, not .exe

#### Test 9.4: Very long filename
- [ ] Create file with 200-character name
- [ ] Upload
- [ ] Expected: Stored in database
- [ ] Expected: Displays in list (may truncate in UI if space tight)

#### Test 9.5: Attachment after log is soft-deleted
- [ ] Create log, upload file
- [ ] Delete log (soft-delete, goes to papelera)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run:
  ```sql
  SELECT * FROM public.log_attachments
  WHERE log_id = '[LOG_ID]' AND deleted_at IS NULL;
  ```
- [ ] Expected: Attachments have deleted_at set (cascade soft-delete)
- [ ] (This depends on log deletion marking attachments too)

#### Test 9.6: Empty file (0 bytes)
- [ ] Create empty file
- [ ] Upload
- [ ] Expected: Accepted (no size validation blocks 0MB)
- [ ] Expected: Shows "0 B" in list

---

### GROUP 10: Integration with Logs Feature

#### Test 10.1: Attachments visible only when editing
- [ ] View log in read-only context (if such exists)
- [ ] Expected: No AttachmentsUploader visible
- [ ] Click Edit
- [ ] Expected: AttachmentsUploader appears

#### Test 10.2: Attachments don't affect log CRUD
- [ ] Upload file to Log A
- [ ] Edit log title (change from "Log A" to "Log A Updated")
- [ ] Click "Actualizar"
- [ ] Expected: Log title updated, attachment still there
- [ ] Expected: No duplicate errors (attachment unrelated)

#### Test 10.3: Delete log → attachments cascade
- [ ] Log with attachments
- [ ] Delete log (soft-delete)
- [ ] Open papelera (check "Ver papelera")
- [ ] Expected: Log visible in trash
- [ ] Try to view attachments (if modal allows in trash)
- [ ] Expected: Attachments should also be marked deleted (depends on implementation)

---

## Summary Checklist

- [ ] All 10 groups tested
- [ ] No UI crashes
- [ ] No TypeScript errors in console
- [ ] No API errors (check Network tab in DevTools)
- [ ] Signed URLs working
- [ ] Soft-deletes persisted to database
- [ ] File size/extension validation working
- [ ] Image previews rendering
- [ ] Performance acceptable

## Issues Found

(List any bugs or unexpected behavior)

- [ ] Issue 1: ...
- [ ] Issue 2: ...

## Sign-Off

**Tested By**: ________________  
**Date**: __________________  
**Overall Status**: ✅ PASS / ❌ FAIL (if fail, explain blockers)

---

**Testing Guide Version**: 1.0  
**Last Updated**: 2026-01-17
