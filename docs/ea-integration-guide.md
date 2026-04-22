# EA Integration Guide: AlphaLog Bot Intelligence Layer

**Version:** 1.0  
**Target Platforms:** MT4, MT5 (GoldRangeBasketR EA)  
**Last Updated:** 2026-04-22

---

## 1. Overview

AlphaLog is a full-stack trading intelligence platform that learns from your trades via reinforcement learning (RL) + large language models (LLM), then provides real-time signal recommendations back to your EA.

### Architecture Flow

```
MT4/MT5 EA (GoldRangeBasketR)
    ↓
    ├─→ GET /api/bot/regime/current (every 15 min)
    │   ↓
    │   [Market Regime via HMM: Bull/Bear/Sideways/Breakout]
    │   [Heston IV Surface: volatility skew by strike & expiry]
    │   [Kelly Criterion: position sizing]
    │
    ├─→ POST /api/bot/signal (every 5 sec during session)
    │   ↓
    │   [Quantum state: Hamiltonian energy, amplitude superposition]
    │   [Circuit breaker: daily P&L limit check]
    │   [Active skill rules: RL-learned + LLM-extracted trading conditions]
    │   ↓
    │   Response: {signal: BUY|SELL|SKIP, confidence, kelly_fraction, vol_target}
    │
    └─→ POST /api/webhooks/mt (on trade close)
        ↓
        [Closed trade with PnL, MAE, session time]
        ↓
        [If paper mode: inserted to paper_trades]
        [If live mode: inserted to trades + skill approval required]
        ↓
        [24h: skill learning cycle runs (RL training + LLM rules)]
        [User reviews skill in AlphaLog UI, approves for live]
```

---

## 2. Security & Authentication

### HMAC-SHA256 Webhook Verification

All webhook requests to `POST /api/webhooks/mt` must be signed with HMAC-SHA256:

```
Header: x-signature: <signature>
Body: JSON payload

signature = HEX(HMAC-SHA256(body_json_string, MT5_WEBHOOK_SECRET))
```

**Important:** Use timing-safe comparison to prevent timing attacks.

### Replay Protection

AlphaLog maintains a 5-minute replay window. The same signature cannot be replayed within this window. Each webhook call should use:
- Current timestamp in `close_time` field
- Unique ticket number in `closed_trade.ticket` field

### Signature Generation Pseudocode

```
function generateSignature(bodyJson, secret):
    hmac = HMAC_SHA256(secret, bodyJson)
    return hexEncode(hmac)

bodyJson = JSON.stringify(payload)  // exact string, no extra spaces
signature = generateSignature(bodyJson, MT5_WEBHOOK_SECRET)
headers["x-signature"] = signature
```

---

## 3. API Endpoints

### 3.1 Market Regime & Engine State

**GET `/api/bot/regime/current`**

Fetch the current market regime, IV surface, Kelly fraction, and circuit breaker status.

**Frequency:** Every 15 minutes (or on new trading session start)

**Auth:** Bearer token required (use `BOT_SIGNAL_SECRET`)

**Response:**
```json
{
  "regime": "BULL_TREND_STRONG",
  "regime_confidence": 0.87,
  "iv_surface": {
    "strikes": [1800, 1850, 1900, ...],
    "expiries": [5, 15, 30, 60, ...],
    "surface": [[19.2, 18.1, ...], ...],
    "spot": 1904.50
  },
  "kelly_fraction": 0.042,
  "vol_target_pct": 0.015,
  "circuit_breaker_triggered": false,
  "circuit_breaker_equity_threshold": 45000,
  "current_equity": 48200,
  "session_date": "2026-04-22",
  "quantum_state": {
    "hamiltonian_energy": 0.742,
    "bull_bias": 0.62,
    "expected_move_pcts": [0.008, 0.015, 0.031]
  }
}
```

### 3.2 Real-Time Signal Engine

**POST `/api/bot/signal`**

Fetch real-time trading signal based on current quantum state, regime, skill rules, and circuit breaker.

**Frequency:** Every 5 seconds during active trading session

**Auth:** Bearer token required (use `BOT_SIGNAL_SECRET`)

**Request:**
```json
{
  "bid": 1904.42,
  "ask": 1904.50,
  "last": 1904.46,
  "balance": 50000,
  "equity": 48200,
  "positions_total": 2,
  "positions_buy": 1,
  "positions_sell": 1,
  "tick_volume": 14250,
  "session": "LONDON",
  "vol_15m": 0.0142
}
```

**Response:**
```json
{
  "signal": "BUY",
  "confidence": 0.78,
  "kelly_fraction": 0.042,
  "vol_target_pct": 0.015,
  "max_position_size": 5.2,
  "circuit_breaker_warning": false,
  "reason": "Bull regime + high confidence + skill rule: regime==BULL_TREND_STRONG AND confidence>0.7",
  "skill_applied": "XAUUSD_v3",
  "quantum_amplitude": 0.891
}
```

### 3.3 Closed Trade Webhook

**POST `/api/webhooks/mt`**

Report a closed trade for RL learning and P&L tracking. **This is the primary integration point.**

**Auth:** HMAC-SHA256 signature verification (see section 2)

**Payload Schema:**
```json
{
  "symbol": "XAUUSD",
  "platform": "MT5",
  "bid": 1904.42,
  "ask": 1904.50,
  "last": 1904.46,
  "balance": 50000,
  "equity": 48200,
  "positions_total": 2,
  "positions_buy": 1,
  "positions_sell": 1,
  "tick_volume": 14250,
  "bot_instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "closed_trade": {
    "ticket": 123456,
    "direction": "BUY",
    "lots": 2.5,
    "open_price": 1900.25,
    "close_price": 1905.80,
    "pnl": 138.75,
    "max_adverse_excursion": 2.15,
    "open_time": "2026-04-22T09:30:00Z",
    "close_time": "2026-04-22T10:15:30Z"
  }
}
```

**Response:**
```json
{
  "received": true,
  "is_paper": false
}
```

**What Happens:**
- ✅ Validates HMAC signature
- ✅ Checks replay protection (5-min window)
- ✅ Updates bot instance (platform, heartbeat)
- ✅ Records in `bot_telemetry` (bid/ask, positions, equity)
- ✅ If `closed_trade` present:
  - If **paper mode**: inserts to `paper_trades`
  - If **live mode**: inserts to `trades`
  - **Live only**: updates `bot_signal_engine_state.current_equity` for session tracking
- ✅ Creates audit log for compliance & learning

---

## 4. Data Flow: From Trade to Skill Activation

### Step 1: EA Reports Closed Trade
```
EA closes trade → POST /api/webhooks/mt
  ↓
signature = HMAC_SHA256(body_json, MT5_WEBHOOK_SECRET)
headers["x-signature"] = signature
```

### Step 2: AlphaLog Validates & Records
```
AlphaLog /api/webhooks/mt
  1. Verify HMAC signature (timing-safe)
  2. Check replay (5-min window)
  3. Validate payload (Zod schema)
  4. Determine is_paper_mode from bot_instances
  5. If closed_trade:
     - SELECT bot_accounts → get user_id
     - INSERT to paper_trades OR trades (based on is_paper_mode)
     - For LIVE: UPDATE bot_signal_engine_state.current_equity
```

### Step 3: 24-Hour Learning Cycle (Automated via QStash Cron)
```
At 02:00 UTC daily:
  POST /api/bot/skills/run-cycle?cron_secret=<TOKEN>
    ↓
    1. Fetch last 24h closed paper_trades (symbol=XAUUSD)
    2. If >= 50 trades:
       - Download current Q-table from Supabase Storage
       - Run RL learning cycle:
         * For each trade: calculate state (regime/confidence/vol/session)
         * Choose action: BUY|SELL|SKIP
         * Calculate reward: pnl / max(mae, ε)
         * Update Q-table via Bellman: Q[s,a] += α * (r + γ*max(Q[s',a']) - Q[s,a])
         * Decay epsilon: ε *= 0.995 (down to 5% min)
       - Extract LLM rules: send 50-trade sample to Claude Sonnet
         * Claude returns: 3-5 rules with conditions + confidence thresholds
       - Upload new model: skills/<INSTRUMENT>/<skillId>_v<N>.json
       - Update bot_skills: status → "pending_approval"
       - Insert audit_log: LEARNING_CYCLE event with metrics
```

### Step 4: User Reviews & Approves in AlphaLog UI
```
AlphaLog Dashboard:
  SkillsPanel shows:
    [Skill XAUUSD_v3] 
    [Status] pending_approval
    [RL] Episodes: 87, Avg Reward: +0.042, Actions Improved: 23
    [LLM] Rules: 5 extracted
    [Performance] Sharpe: +0.18, Win Rate: +3.2%, Avg PnL: +$145
    [⚠️ WARNING] Only for paper trading!
    [APPROVE] [REJECT]
```

### Step 5: Skill Activation (Live Paper Trading)
```
User clicks [APPROVE]
  ↓
POST /api/bot/skills/approve
  {skillId, approved: true}
  ↓
1. UPDATE bot_skills: status → "approved"
2. UPSERT bot_active_skill:
     {instrument: "XAUUSD", skill_id: skillId, q_table_path: "...", llm_rules: [...]}
3. INSERT audit_log: APPROVED event
```

### Step 6: Signal Engine Uses Active Skill
```
POST /api/bot/signal (every 5 sec)
  ↓
1. SELECT bot_signal_engine_state: get current quantum state
2. SELECT bot_active_skill for XAUUSD: fetch Q-table + LLM rules
3. Evaluate LLM rules against current regime/confidence
4. Return signal: BUY|SELL|SKIP with skill_applied metadata
  ↓
EA receives: {signal, confidence, kelly_fraction, max_position_size}
```

---

## 5. Environment Variables (EA Side)

Set these in your EA's configuration or environment:

```bash
# AlphaLog Base URL
ALPHALOG_API_URL=https://alphalog.io/api

# Security tokens
BOT_SIGNAL_SECRET=<token>        # For GET /api/bot/regime/* + POST /api/bot/signal
MT5_WEBHOOK_SECRET=<secret>      # For HMAC signing webhooks
BOT_INSTANCE_ID=<uuid>           # UUID of this bot instance in AlphaLog

# Optional: override defaults
SIGNAL_REQUEST_INTERVAL_SECONDS=5
REGIME_UPDATE_INTERVAL_SECONDS=900  # 15 minutes
WEBHOOK_RETRY_MAX_ATTEMPTS=3
WEBHOOK_TIMEOUT_SECONDS=10
WEBHOOK_BACKOFF_FACTOR=1.5  # exponential backoff
```

---

## 6. Implementation Steps (Pseudocode)

### Step 6.1: Initialize at EA Startup

```
function EA_Init():
    // Load configuration
    config = loadEnv(["ALPHALOG_API_URL", "BOT_SIGNAL_SECRET", "BOT_INSTANCE_ID", "MT5_WEBHOOK_SECRET"])
    
    // Fetch initial regime (block until success or timeout)
    max_retries = 3
    for attempt = 1 to max_retries:
        response = GET_SYNC(
            url: config.ALPHALOG_API_URL + "/bot/regime/current",
            headers: {"Authorization": "Bearer " + config.BOT_SIGNAL_SECRET}
        )
        if response.status == 200:
            currentRegime = response.json["regime"]
            currentKelly = response.json["kelly_fraction"]
            break
        else:
            wait(2^attempt seconds)
    
    // Log startup
    logMessage("EA initialized. Regime: " + currentRegime + ", Kelly: " + currentKelly)
    
    lastRegimeUpdate = now()
    lastSignalTime = now()
    return true
```

### Step 6.2: On Every Tick (High Frequency)

```
function OnTick():
    currentTime = now()
    
    // Update regime every 15 minutes (or on session start)
    if (currentTime - lastRegimeUpdate) > 900 seconds:
        fetchRegimeNonBlocking()  // async, don't block ticks
    
    // Fetch signal every 5 seconds
    if (currentTime - lastSignalTime) > 5 seconds:
        signal = getSignalSynchronously()  // block briefly (max 2s timeout)
        if signal != null:
            evaluateSignal(signal)
        lastSignalTime = currentTime
    
    // Regular position management
    updateOpenPositions()
```

### Step 6.3: Request Signal (5-sec Interval)

```
function getSignalSynchronously():
    bid = MarketInfo(Symbol(), MODE_BID)
    ask = MarketInfo(Symbol(), MODE_ASK)
    equity = AccountEquity()
    balance = AccountBalance()
    
    payload = {
        "bid": bid,
        "ask": ask,
        "last": (bid + ask) / 2,
        "balance": balance,
        "equity": equity,
        "positions_total": CountOpenPositions(),
        "positions_buy": CountBuyPositions(),
        "positions_sell": CountSellPositions(),
        "tick_volume": Volume[0],
        "session": detectTradingSession(),
        "vol_15m": calculateVolatility15m()
    }
    
    try:
        response = POST_WITH_TIMEOUT(
            url: config.ALPHALOG_API_URL + "/bot/signal",
            headers: {
                "Authorization": "Bearer " + config.BOT_SIGNAL_SECRET,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            timeout_ms: 2000
        )
        
        if response.status == 200:
            return response.json  // {signal, confidence, kelly_fraction, reason, ...}
        else:
            logError("Signal endpoint returned " + response.status)
            return null
    catch exception as e:
        logError("Signal request failed: " + e.message)
        return null
```

### Step 6.4: Evaluate Signal & Place Order

```
function evaluateSignal(signal):
    // signal = {signal: "BUY"|"SELL"|"SKIP", confidence, kelly_fraction, max_position_size, ...}
    
    if signal["signal"] == "SKIP":
        return  // no action
    
    currentEquity = AccountEquity()
    kellyFraction = signal["kelly_fraction"]
    maxRisk = currentEquity * 0.02  // 2% risk per trade (or use kelly_fraction)
    lots = calculateLotSize(maxRisk)
    
    if signal["signal"] == "BUY":
        if not hasOpenBuy():
            openBuy(lots, stopLoss, takeProfit)
            logMessage("BUY signal (confidence: " + signal["confidence"] + ")")
    
    else if signal["signal"] == "SELL":
        if not hasOpenSell():
            openSell(lots, stopLoss, takeProfit)
            logMessage("SELL signal (confidence: " + signal["confidence"] + ")")
```

### Step 6.5: On Trade Close (Critical for Learning)

```
function OnTradeClose(ticket, direction, lots, openPrice, closePrice, pnl, openTime, closeTime):
    // Calculate trade metrics
    mae = calculateMaxAdverseExcursion(openPrice, lowestPrice, direction)  // Max loss if exited at worst point
    
    payload = {
        "symbol": "XAUUSD",
        "platform": "MT5",  // or "MT4"
        "bid": Bid,
        "ask": Ask,
        "last": (Bid + Ask) / 2,
        "balance": AccountBalance(),
        "equity": AccountEquity(),
        "positions_total": CountOpenPositions(),
        "positions_buy": CountBuyPositions(),
        "positions_sell": CountSellPositions(),
        "tick_volume": Volume[0],
        "bot_instance_id": config.BOT_INSTANCE_ID,
        "closed_trade": {
            "ticket": ticket,
            "direction": direction,  // "BUY" or "SELL"
            "lots": lots,
            "open_price": openPrice,
            "close_price": closePrice,
            "pnl": pnl,
            "max_adverse_excursion": mae,
            "open_time": ISO8601(openTime),
            "close_time": ISO8601(closeTime)
        }
    }
    
    // Generate HMAC signature
    bodyJson = JSON.stringify(payload)
    signature = hexEncode(HMAC_SHA256(config.MT5_WEBHOOK_SECRET, bodyJson))
    
    // Send webhook with retry logic
    for attempt = 1 to 3:
        try:
            response = POST_WITH_TIMEOUT(
                url: config.ALPHALOG_API_URL + "/webhooks/mt",
                headers: {
                    "x-signature": signature,
                    "Content-Type": "application/json"
                },
                body: bodyJson,
                timeout_ms: 10000
            )
            
            if response.status == 200:
                logMessage("Trade reported successfully. Response: " + response.json["received"])
                return true
            else:
                logError("Webhook returned " + response.status + ", retrying...")
        catch exception as e:
            logError("Webhook attempt " + attempt + " failed: " + e.message)
        
        wait(min(2^attempt, 30) seconds)  // exponential backoff, cap at 30s
    
    logError("Failed to report trade after 3 attempts. Manual sync required.")
    return false
```

### Step 6.6: Session Management

```
function detectTradingSession():
    utcHour = hour(ServerTime())
    
    // London: 08:00-16:00 UTC
    if utcHour >= 8 AND utcHour < 16:
        return "LONDON"
    
    // New York: 13:00-22:00 UTC
    if utcHour >= 13 AND utcHour < 22:
        return "NY"
    
    // Overlap: 13:00-16:00 UTC
    if utcHour >= 13 AND utcHour < 16:
        return "OVERLAP"
    
    return "CLOSED"

function calculateVolatility15m():
    // Simple: close-to-close std dev over last 15 periods (1-min bars)
    closes = getLastNCloses(15)
    returns = logReturns(closes)
    stdDev = stdev(returns)
    annualized = stdDev * sqrt(252 * 24 * 60)  // annualize to 1-min bars
    return annualized
```

---

## 7. Error Handling & Resilience

### Network Failures
- **Timeout (>2s)**: Log warning, use last known signal, continue
- **HTTP 5xx**: Exponential backoff (2s, 4s, 8s, cap 30s), retry up to 3x
- **Invalid response**: Log error with response body, fall back to manual trading mode

### Signal Ambiguity
- **Confidence < 0.5**: Ignore signal, continue with open positions
- **Circuit breaker triggered**: Close all positions immediately, block new orders for rest of session
- **Skill not yet approved**: Use quantum baseline (no LLM rules), log warning

### Signature Verification Failures
- **Replay detected**: Log error, discard webhook response (but still update telemetry internally)
- **Invalid HMAC**: Reject immediately, alert admin

---

## 8. Monitoring & Alerts

### Recommended Logging Points

```
Log at INFO level:
  - EA startup: "GoldRangeBasketR initialized, regime=<>, kelly=<>"
  - Signal received: "Signal: <BUY|SELL|SKIP>, confidence=<>, reason=<>"
  - Trade closed: "Trade closed. Ticket=<>, PnL=<>, MAE=<>, reported=<true|false>"
  - Skill approved: "New skill XAUUSD_v3 activated. Rules count=<>"

Log at WARN level:
  - Signal timeout: "Signal request timeout, using last known signal"
  - Regime update stale: "Regime not updated in >20 min, check connectivity"
  - Webhook retry: "Webhook retry attempt 2/3 for ticket <>"
  - Circuit breaker: "Circuit breaker triggered. Daily PnL threshold exceeded."

Log at ERROR level:
  - HMAC signature mismatch (tampered request?)
  - Repeated webhook failures (>3 attempts)
  - Connectivity loss >5 min
  - Invalid payload structure
```

### Dashboard Metrics to Track

In AlphaLog Dashboard → Bot Control → Engine DevTools:
- **Signal latency**: avg response time of `/api/bot/signal`
- **Skill learning progress**: episodes/day, epsilon decay, reward trend
- **Circuit breaker events**: count, dates, reasons
- **Webhook success rate**: % trades successfully reported
- **Regime accuracy**: match against manual observations

---

## 9. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Signature verification fails | Wrong `MT5_WEBHOOK_SECRET` or body JSON not exact match | Verify secret in env, ensure JSON.stringify with no extra spaces |
| "Replay attack detected" (HTTP 429) | Same signature seen within 5 min | Add unique timestamp & ticket to each trade |
| Signal endpoint returns 401 | Invalid `BOT_SIGNAL_SECRET` token | Check token in env, regenerate in AlphaLog admin panel |
| Skill never transitions to "approved" | `is_paper_mode=false` on bot_instances | Only paper trades trigger learning cycles, verify mode setting |
| Circuit breaker doesn't trigger | Daily PnL threshold too high | Adjust in `bot_signal_engine_state.circuit_breaker_equity_threshold` |
| No LLM rules extracted | <50 paper trades in last 24h | Run learning cycle manually after accumulating trades |
| Signal latency >2s | API overload or network issue | Increase timeout, implement local fallback logic |

---

## 10. Compliance & Security Checklist

- [ ] HMAC signatures verified on every webhook (timing-safe comparison)
- [ ] Secrets stored in environment variables, never hardcoded
- [ ] Replay protection: 5-minute window, unique tickets
- [ ] SSL/TLS enforced: all requests to `https://alphalog.io`
- [ ] Request timeouts set: signal <2s, webhook <10s
- [ ] Audit logs created for all trade reports
- [ ] Error logging captures request/response for debugging
- [ ] EA logs rotated regularly (avoid disk space issues)
- [ ] Paper mode validated server-side (never trusts client)
- [ ] Circuit breaker tested: verify positions closed on threshold

---

## 11. API Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response normally |
| 400 | Bad request (invalid JSON/schema) | Fix payload, log error details |
| 401 | Unauthorized (bad signature/token) | Check credentials, retry after fix |
| 403 | Forbidden (RLS policy) | Verify user ownership of bot_instance |
| 404 | Not found (skill/regime not available) | Wait for next learning cycle |
| 429 | Replay detected (same signature within 5 min) | Add unique timestamp/ticket |
| 500 | Server error | Retry with exponential backoff |
| 502, 503, 504 | Temporary unavailability | Retry with exponential backoff, use fallback signal |

---

## 12. Versioning & Upgrades

This integration guide documents **AlphaLog Signal Engine v1.0**.

**Backwards Compatibility:**
- Endpoints `/api/bot/regime/current`, `/api/bot/signal`, `/api/webhooks/mt` are stable
- New fields in responses are optional (use `.get()` with fallback)
- Deprecated endpoints will be announced 6 months in advance

**Upgrade Path:**
- Check `ETag` header in 200 responses for schema version
- Breaking changes will be prefixed with `/v2/` URLs

---

## 13. Example: Full Trade Lifecycle

```
=== 09:00 UTC: EA Starts ===
GET /api/bot/regime/current
  → response: {regime: "BULL_TREND_STRONG", kelly: 0.042, ...}
  → EA logs regime, sets Kelly fraction

=== 09:05 UTC: 5-Second Signal Loop ===
POST /api/bot/signal (tick 1)
POST /api/bot/signal (tick 2)
...every 5 seconds...

=== 09:15 UTC: Trade Entry ===
POST /api/bot/signal
  → response: {signal: "BUY", confidence: 0.82, kelly_fraction: 0.042, ...}
  → EA opens 2.5 lots BUY @ 1904.25
  → EA logs: "BUY signal (confidence 0.82), opened 2.5 lots"

=== 10:30 UTC: Trade Exit ===
EA closes trade: 2.5 lots @ 1906.80, PnL: +$137.50, MAE: 1.85 pips
POST /api/webhooks/mt
  body: {symbol: "XAUUSD", platform: "MT5", closed_trade: {...}, ...}
  header: x-signature: a7f9e2c...
  → response: {received: true, is_paper: true}
  → EA logs: "Trade reported. Response: received=true"

=== 02:00 UTC+1 (next day): Learning Cycle ===
Cron: POST /api/bot/skills/run-cycle
  → 87 paper trades processed
  → RL: Q-table updated, epsilon decayed to 0.298
  → LLM: 5 rules extracted (regime + confidence conditions)
  → Status: bot_skills.status = "pending_approval"
  → Audit log: {event_type: "LEARNING_CYCLE", episodes: 87, reward_avg: 0.042}

=== 14:00 UTC+1: User Reviews in AlphaLog ===
SkillsPanel shows:
  [Skill XAUUSD_v3]
  [Performance] Sharpe +0.18, Win Rate +3.2%
  [⚠️ Paper Trading Only]
  User clicks [APPROVE]

=== Immediate: Skill Activation ===
POST /api/bot/skills/approve {skillId, approved: true}
  → bot_skills.status = "approved"
  → bot_active_skill.skill_id = skillId
  → Audit log: {event_type: "APPROVED", ...}

=== 09:00 UTC (next session): Active Skill in Use ===
POST /api/bot/signal
  → Fetches bot_active_skill.q_table_path + llm_rules
  → Response includes: skill_applied: "XAUUSD_v3", signal: "BUY" (from LLM rule)
  → EA trades using learned rules
```

---

## References

- **Main Webhook Route**: `src/app/api/webhooks/mt/route.ts`
- **Signal Engine**: `src/lib/bot/signal-engine/`
- **RL Learning**: `src/lib/bot/skills/rl-engine.ts`
- **LLM Rules**: `src/lib/bot/skills/llm-rules.ts`
- **Skill Manager**: `src/lib/bot/skills/skill-manager.ts`
- **Database Migrations**: `supabase/migrations/046-053_bot_*.sql`
- **Types**: `src/lib/bot/skills/types.ts`, `src/lib/bot/signal-engine/types.ts`

---

**Contact**: rivejova2015@gmail.com  
**Project**: AlphaLog PWA (https://alphalog.io)  
**Last Revision**: 2026-04-22
