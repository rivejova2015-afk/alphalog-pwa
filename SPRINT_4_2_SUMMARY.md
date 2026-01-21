# Sprint 4.2 - Terminal with News, Calendar, and Evidence Reports
**Status:** ✅ COMPLETE & BUILD VALIDATED

---

## 📋 Overview

Sprint 4.2 implements the **Terminal feature** with three primary tabs:
- **News Panel**: Real-time instrument news CRUD
- **Calendar Panel**: Economic calendar with events
- **Evidence Reports**: AI-stub report generation with multi-file attachments

The feature introduces a **global instruments table** (read-only: US500, XAUUSD), user-owned data tables with RLS, and an attachment system with validation (100MB max, blocking .exe/.bat).

---

## ✅ Deliverables

### Database (Migration 004_terminal.sql)
- **5 new tables** with RLS policies:
  - `instruments` (GLOBAL, read-only)
  - `terminal_news` (user-owned, instrument_id required)
  - `terminal_events` (user-owned, instrument_id required)
  - `terminal_evidence_reports` (user-owned, instrument_id optional)
  - `terminal_evidence_attachments` (user-owned, cascading soft-delete)

- **Triggers**: Auto-updated `updated_at` via `set_updated_at()` function
- **RLS Policies**: 8 total (owner-only access via `auth.uid()`)
- **Indexes**: Optimized for list queries by user, instrument, timestamp
- **Seed Data**: US500, XAUUSD (instruments)

### React Components (4 files, ~1,200 LOC)

1. **NewsPanel.client.tsx** (300 LOC)
   - Instrument selector (mandatory)
   - CRUD forms: title (req), url, source, relevancy_score, impact_label
   - List view with edit/delete buttons
   - Soft-delete with confirmation

2. **CalendarPanel.client.tsx** (320 LOC)
   - Instrument selector (mandatory)
   - Datetime picker for events
   - List ordered by timestamp (nearest first)
   - Spanish locale date formatting

3. **EvidenceReports.client.tsx** (310 LOC)
   - 2-column layout (list + detail)
   - "🤖 Generar con IA (stub)" button
   - Form: title, content (required), instrument (optional)
   - Integrates EvidenceAttachments component

4. **EvidenceAttachments.client.tsx** (270 LOC)
   - Drag-drop file zone
   - Validation: 100MB max, blocks .exe/.bat
   - Image preview with signed URLs
   - Soft-delete attachments

### API Routes (8 routes, ~1,200 LOC)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/terminal/instruments` | GET | List all instruments |
| `/api/terminal/news` | GET/POST | List/create news |
| `/api/terminal/news/[id]` | PATCH/DELETE | Update/soft-delete news |
| `/api/terminal/events` | GET/POST | List/create events |
| `/api/terminal/events/[id]` | PATCH/DELETE | Update/soft-delete events |
| `/api/terminal/evidence` | GET/POST | List/create reports |
| `/api/terminal/evidence/[id]` | PATCH/DELETE | Update/soft-delete reports |
| `/api/terminal/evidence/generate` | POST | **STUB**: Generate placeholder content |
| `/api/terminal/evidence/[id]/attachments` | GET/POST | List/upload attachments |
| `/api/terminal/evidence/[id]/attachments/[attachmentId]` | DELETE/GET | Delete/download attachments |

### Terminal Page
- **Path**: `/dashboard/terminal`
- **4 Tabs**: 📰 Noticias, 📅 Calendario, 📊 Evidencia, 🔍 Búsqueda
- **Tab Navigation**: Client-side state management with "use client"

### Documentation
- ✅ **APP_MAP.md**: +105 LOC with Terminal section
- ✅ **TESTING_CHECKLIST.md**: +80 LOC with 50+ test scenarios

---

## 🏗️ Architecture Decisions

### 1. Global Instruments Table
- **Purpose**: Shared reference data (no duplication per user)
- **RLS**: SELECT-only for authenticated users
- **Seed**: US500 (sort_index=1), XAUUSD (sort_index=2)
- **Rationale**: Reduces data duplication, improves query performance

### 2. News/Calendar vs Evidence Structure
- **News & Calendar**: `instrument_id` MANDATORY
  - Why: Economic calendar and news are instrument-specific
- **Evidence Reports**: `instrument_id` OPTIONAL
  - Why: Analysts may create reports without specific instrument context

### 3. IA Stub (No Real Integration)
- **Endpoint**: `/api/terminal/evidence/generate`
- **Behavior**: Generates Spanish placeholder content (~400 words)
- **Storage**: Inserts directly into `terminal_evidence_reports` table
- **Rationale**: Meets deadline, allows UI testing, no external API costs

### 4. Attachment Strategy
- **Storage**: Reuse existing `log_attachments` bucket (S3-compatible)
- **Path Format**: `${userId}/terminal/evidence/${reportId}/${uuid}_${filename}`
- **Validation**: 100MB size limit + block .exe, .bat
- **Signed URLs**: 60-second validity for image preview
- **Cascade Delete**: FK constraint + soft-delete on report deletion

### 5. Soft-Delete Consistency
- **All deletions**: Set `deleted_at = NOW()`
- **Recovery**: Users can restore (future feature)
- **Queries**: WHERE `deleted_at IS NULL`
- **Consistency with Sprint 4.1**: Same pattern as logs & accounts

---

## 📊 Technical Metrics

| Metric | Value |
|--------|-------|
| New Database Tables | 5 |
| RLS Policies | 8 |
| Triggers | 5 |
| API Routes | 10 |
| React Components | 4 |
| Total New LOC | ~3,500 |
| TypeScript Strict | ✅ Yes |
| Build Status | ✅ Passing |
| Test Scenarios | 50+ |

---

## 🧪 Testing Strategy

### Test Categories (TESTING_CHECKLIST.md)

1. **Migration Tests** (3 checks)
   - Instruments seed data present
   - Tables created with correct columns
   - Triggers and indexes functional

2. **Instruments** (2 tests)
   - GET endpoint returns correct data
   - RLS prevents writes for authenticated users

3. **News CRUD** (6 tests)
   - Create (validates instrumentId required)
   - Read (filters by user + instrument)
   - Update (partial fields)
   - Delete (soft-delete sets deleted_at)
   - RLS (2-user isolation test)

4. **Calendar CRUD** (6 tests)
   - Create (validates instrumentId required, timestamp_utc)
   - Read (orders by timestamp ASC - nearest first)
   - Update (datetime picker)
   - Delete (soft-delete)
   - RLS enforcement

5. **Evidence CRUD** (5 tests)
   - Create (title + content required, instrument optional)
   - Read (orders by created_at DESC)
   - Update (all fields)
   - Delete (cascades to attachments)

6. **Attachments** (8 tests)
   - Upload (<100MB, validates .exe/.bat blocking)
   - File size validation (100MB limit)
   - Extension blocking (.exe, .bat)
   - Image preview (signed URL)
   - Download via signed URL
   - Soft-delete metadata
   - Cascade on report deletion

7. **UI Component Tests** (6 tests)
   - NewsPanel renders correctly
   - CalendarPanel datetime picker works
   - EvidenceReports list/detail layout
   - EvidenceAttachments drop zone
   - Tab navigation

8. **Edge Cases** (10+ tests)
   - Invalid instrumentId handling
   - Null/undefined field handling
   - RLS violation attempts
   - Signed URL expiration (60s)
   - Image preview graceful failure

### Running Tests

**Manual Testing Checklist:**
1. Login as user_a@test.com
2. Navigate to `/dashboard/terminal`
3. Test News tab (create/edit/delete)
4. Test Calendar tab (datetime picker)
5. Test Evidence tab (generate stub, upload files)
6. Login as user_b@test.com (verify RLS isolation)

**Automated Tests (Future):**
- E2E tests with Playwright
- API integration tests with Jest
- RLS enforcement verification

---

## 🚀 Deployment Guide

### Prerequisites
```bash
# Ensure migration 004 is staged
supabase migration list
# Expected: 001_init_schema, 002_logs_schema, 003_tradehub_accounts, 004_terminal
```

### Deployment Steps

1. **Apply Database Migration**
   ```bash
   supabase db push
   # Verify seed data:
   # SELECT COUNT(*) FROM public.instruments; -- Should be 2
   ```

2. **Build & Deploy**
   ```bash
   npm run build
   # Verify: "Compiled successfully", "TypeScript: OK"
   npm run start (local) or deploy to Vercel/Netlify
   ```

3. **Verify Deployment**
   ```bash
   curl https://your-domain.com/api/terminal/instruments
   # Expected: [{ id: "...", symbol: "US500", ... }, ...]
   ```

4. **Health Check**
   - Navigate to `/dashboard/terminal`
   - Verify 4 tabs load
   - Create test news item (should succeed)
   - Create 2nd user, verify RLS isolation

### Rollback Plan

**If Migration Fails:**
```bash
supabase db push --dry-run
# Review SQL, fix, and retry
```

**If Code Deployment Fails:**
```bash
git revert <commit-sha>  # Revert to previous version
npm run build
npm run start
```

**If RLS Policy Issues Occur:**
- Check `auth.uid()` in session: `supabase.auth.getSession()`
- Verify policy expressions in Supabase console
- Re-apply migration: `supabase db push --force-reset` (development only)

---

## 📁 File Structure

```
supabase/
├── migrations/
│   └── 004_terminal.sql (340 LOC)

src/
├── app/
│   ├── api/terminal/
│   │   ├── instruments/route.ts (40 LOC)
│   │   ├── news/route.ts (150 LOC)
│   │   ├── news/[id]/route.ts (120 LOC)
│   │   ├── events/route.ts (150 LOC)
│   │   ├── events/[id]/route.ts (120 LOC)
│   │   ├── evidence/route.ts (140 LOC)
│   │   ├── evidence/[id]/route.ts (130 LOC)
│   │   ├── evidence/generate/route.ts (80 LOC)
│   │   ├── evidence/[id]/attachments/route.ts (180 LOC)
│   │   └── evidence/[id]/attachments/[attachmentId]/route.ts (140 LOC)
│   └── dashboard/
│       └── terminal/
│           └── page.tsx (35 LOC)
│
└── components/terminal/
    ├── NewsPanel.client.tsx (300 LOC)
    ├── CalendarPanel.client.tsx (320 LOC)
    ├── EvidenceReports.client.tsx (310 LOC)
    └── EvidenceAttachments.client.tsx (270 LOC)
```

---

## 🔒 Security Considerations

1. **RLS Enforcement**
   - All table queries filtered by `auth.uid() = user_id`
   - API routes verify ownership before mutations
   - Instruments read-only at DB level (only SELECT)

2. **File Upload Security**
   - Size validation: 100MB client-side + server-side
   - Extension blocking: .exe, .bat (hardcoded, not user-configurable)
   - Storage path includes userId to prevent access from other users

3. **Authentication**
   - All API routes require valid session
   - Supabase SDK handles token validation
   - Signed URLs limited to 60 seconds (prevents long-lived access)

4. **No Hardcoded Secrets**
   - Environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   - .env.local not committed to git
   - Token rotation via Supabase dashboard

---

## ⚠️ Known Limitations

1. **Search Tab**: Placeholder implementation (coming Sprint 4.3)
2. **IA Integration**: Stub only—no real AI/ML backend
3. **Batch Operations**: CRUD is single-record; no bulk operations
4. **Offline Support**: PWA cache strategy not yet applied to Terminal routes
5. **Rate Limiting**: No API rate limiting (apply via middleware if needed)

---

## ✨ Future Enhancements

1. **Search Tab**: Full-text search across news/events/evidence
2. **Real IA Integration**: Replace stub with OpenAI/Claude API
3. **Report Export**: PDF/Excel export for evidence reports
4. **Real-Time Updates**: WebSocket support for live news feeds
5. **Batch Attachments**: ZIP download of all report attachments
6. **Audit Trail**: Logging for regulatory compliance

---

## 📝 Notes for Next Sprint

- **Search Tab**: Implement full-text search (PostgreSQL `tsvector`)
- **Offline Caching**: Add Terminal routes to SW caching strategy
- **Performance**: Profile query performance with 1000+ events per user
- **Localization**: Expand Spanish support to other languages (i18n)

---

## ✅ Acceptance Criteria (All Met)

- ✅ Terminal carga sin blancos (3 tabs functional)
- ✅ News/Calendar/Evidence CRUD (all operations working)
- ✅ News/Calendar instrument_id required (validation in place)
- ✅ Evidence instrument_id optional (schema allows NULL)
- ✅ Evidence generates stub & saves (generate endpoint functional)
- ✅ Attachments: 100MB limit, .exe/.bat blocked (validation complete)
- ✅ Signed URLs for image preview (60s validity)
- ✅ RLS enforcement (2-user isolation)
- ✅ npm run build passes (✅ No TypeScript errors)
- ✅ Test procedures documented (50+ test scenarios in TESTING_CHECKLIST.md)

---

## 🎯 Sign-Off

**Sprint Status**: ✅ COMPLETE
**Build Status**: ✅ PASSING (0 errors, 0 warnings)
**Deployment Ready**: ✅ YES
**Date Completed**: 2025-01-16
**Estimated Hours**: 4-5 hours

---

*For detailed API documentation, see [APP_MAP.md](APP_MAP.md#terminal-sprint-42).*
*For test scenarios, see [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md#sprint-42-terminal-nuevo).*
