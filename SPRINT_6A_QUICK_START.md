# SPRINT 6A - Quick Start Testing

**Goal**: Verify offline + push features in 5 minutes

---

## Setup (1 minute)

```bash
cd ~/alphalog-pwa

# Install VAPID keys (save output for later)
npx web-push generate-vapid-keys

# Create/update .env.local
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=<your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
NEXT_PUBLIC_ENABLE_SW=true
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key-from-above>
VAPID_PRIVATE_KEY=<private-key-from-above>
VAPID_SUBJECT=mailto:test@example.com
EOF

# Run dev server
npm run dev
```

---

## Test 1: Offline Mode (1 minute)

```
1. Open http://localhost:3000/dashboard/tradehub
2. F12 → Network tab
3. Throttle dropdown → Select "Offline"
4. Refresh page
5. Expected:
   ✓ Page loads with cached data
   ✓ OfflineBanner visible: "📡 Offline — modo lectura"
   ✓ "Ir a Dashboard" button works
6. Close DevTools (F12)
```

---

## Test 2: Push Subscription (2 minutes)

```
1. Still on /dashboard/tradehub (online now)
2. Look for button in top-right: "🔔 Activar notificaciones"
3. Click button
4. Browser prompt: "Allow notifications?" → Click "Allow"
5. Expected:
   ✓ Button changes to "✉️ Enviar prueba"
   ✓ Success message: "✅ Notificaciones habilitadas"
6. Database verification:
   - Open Supabase dashboard
   - SQL Editor → paste:
     SELECT COUNT(*) FROM push_subscriptions;
   - Should see: count = 1 (your subscription)
```

---

## Test 3: Test Push Notification (1 minute)

```
1. On /dashboard/tradehub with button showing "✉️ Enviar prueba"
2. Click "✉️ Enviar prueba"
3. Expected:
   ✓ Notification appears in bottom-right corner
   ✓ Title: "✅ Notificación de Prueba"
   ✓ Body: "AlphaLog Push funciona correctamente"
4. Verify with DevTools:
   - F12 → Application → Service Workers
   - Status: "activated and running"
   - Cache storage: "alphalog-v6a-1" exists
```

---

## Test 4: Trigger - Report Generation (1 minute)

```
1. Click "Reports" tab in TradeHub
2. Click "Generate Report" (if no existing one)
3. Report generates successfully
4. Expected:
   ✓ Desktop notification appears
   ✓ Title: "📊 AlphaBrief Generado"
   ✓ Body includes: "X operaciones, P&L $Y.YY"
```

---

## Checklist ✓

- [ ] Test 1: Offline mode works
- [ ] Test 2: Push subscription saves to DB
- [ ] Test 3: Test notification delivers
- [ ] Test 4: Report trigger sends notification
- [ ] No errors in browser console (F12)
- [ ] Service Worker shows as "activated and running"

**Status**: ✅ All tests pass → Ready to deploy

---

## If Something Fails

| Issue | Fix |
|-------|-----|
| Offline page blank | First visit dashboard while online |
| Push permission denied | Reset in browser settings → Sites → Privacy → Notifications |
| No notification appears | Check VAPID keys are set, restart `npm run dev` |
| SW not activated | Hard refresh `Ctrl+Shift+R`, clear cache `Ctrl+Shift+Delete` |
| Database query error | Verify migration 009 applied in Supabase |

---

**All tests passing?** You're ready for production deployment! See SPRINT_6A_DEPLOYMENT_GUIDE.md
