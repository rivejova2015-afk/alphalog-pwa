# GoldRangeBasketR EA — Setup & Compilation Guide

**Version:** 1.0  
**Date:** 2026-04-22  
**Target Platforms:** MT5, MT4

---

## 1. Pre-Compilation Requirements

### For MT5 (Recommended)

- **MT5 Installation**: Latest version (build 3800+)
- **IDE**: MetaEditor (included with MT5)
- **Compiler**: MSVC (part of MetaEditor)
- **Libraries**: Trade.mqh (included in MT5 standard library)

### For MT4

- **MT4 Installation**: Latest version (build 1090+)
- **IDE**: MetaEditor (included with MT4)
- **Compiler**: MSVC (part of MetaEditor)
- **Standard Library**: stdlib.mqh

---

## 2. File Organization

```
bots/
├── GoldRangeBasketR_EA.mq5          ← MT5 Expert Advisor
├── GoldRangeBasketR_EA.mq4          ← MT4 Expert Advisor
├── EA_SETUP_GUIDE.md                ← This file
└── README_EA.md                     ← Features & architecture
```

### Directory Structure in MT5/MT4

```
MetaTrader 5/
├── Experts/
│   └── GoldRangeBasketR_EA.mq5      ← Place MT5 EA here
├── Libraries/
│   └── (Trade.mqh is included)
└── Logs/
    └── (EA logs written here)

MetaTrader 4/
├── experts/
│   └── GoldRangeBasketR_EA.mq4      ← Place MT4 EA here
├── libraries/
│   └── (stdlib.mqh is included)
└── logs/
    └── (EA logs written here)
```

---

## 3. Compilation Steps (MT5)

### Step 1: Copy EA to MetaTrader 5

```bash
# Copy the MQ5 file to your MT5 Experts folder
cp bots/GoldRangeBasketR_EA.mq5 "C:\Program Files\MetaTrader 5\MQL5\Experts\"
```

### Step 2: Open in MetaEditor

1. In MT5, go to **Tools → MetaEditor** (or press F4)
2. File → Open...
3. Navigate to `MQL5/Experts/GoldRangeBasketR_EA.mq5`
4. Click Open

### Step 3: Compile

1. **Menu**: Tools → Compile (or press Ctrl+F7)
2. Or click the **Compile** button in toolbar
3. Check **Output** panel for errors

**Expected Output:**
```
GoldRangeBasketR_EA.mq5 compiled successfully
```

### Step 4: Verify EX5 File

After successful compilation, verify the .ex5 file was created:

```bash
ls -la "C:\Program Files\MetaTrader 5\MQL5\Experts\*.ex5"
```

You should see: `GoldRangeBasketR_EA.ex5`

---

## 4. Compilation Steps (MT4)

### Step 1: Copy EA to MetaTrader 4

```bash
cp bots/GoldRangeBasketR_EA.mq4 "C:\Program Files\MetaTrader 4\experts\"
```

### Step 2: Open in MetaEditor

1. In MT4, go to **Tools → MetaEditor** (or press F4)
2. File → Open...
3. Navigate to `experts/GoldRangeBasketR_EA.mq4`
4. Click Open

### Step 3: Compile

1. **Menu**: Tools → Compile (or press Ctrl+F7)
2. Check **Output** panel for errors

**Expected Output:**
```
GoldRangeBasketR_EA.mq4 compiled successfully
```

### Step 4: Verify EX4 File

```bash
ls -la "C:\Program Files\MetaTrader 4\experts\*.ex4"
```

You should see: `GoldRangeBasketR_EA.ex4`

---

## 5. Configuration (Critical!)

### Step 1: Get AlphaLog Credentials

Log in to AlphaLog (https://alphalog.io) and go to:
**Dashboard → Bot Control → Configuration**

You'll find:
- `BOT_SIGNAL_SECRET` — Token for signal API
- `MT5_WEBHOOK_SECRET` — Secret for trade webhook
- `BOT_INSTANCE_ID` — UUID of this bot instance

### Step 2: Configure EA in MT5

**In MT5:**

1. **Tools → Options** (or Alt+O)
2. **Advisors** tab
3. Enable **Allow external DLL imports** (for HMAC crypto)
4. Enable **Allow WebRequest for the listed URL**:
   ```
   https://alphalog.io/api/
   ```
5. Click **OK**

**Now attach the EA to a chart:**

1. In MT5 Terminal, open **MarketWatch** (Ctrl+M)
2. Find **XAUUSD** (Gold)
3. Right-click → **New Order** → Select timeframe (M1 recommended)
4. A chart opens
5. Drag **GoldRangeBasketR_EA** from **Experts** folder onto the chart
6. **Expert Advisors** panel opens with input fields

### Step 3: Enter Parameters (MT5)

In the **Expert Advisors** panel, set:

| Parameter | Value | Description |
|-----------|-------|-------------|
| InputBotSignalSecret | (paste token) | From AlphaLog Config |
| InputWebhookSecret | (paste secret) | From AlphaLog Config |
| InputBotInstanceId | (paste UUID) | From AlphaLog Config |
| InputLotSize | 0 | Auto-calculate (0 = auto) |
| InputMaxLotSize | 10.0 | Max per trade |
| InputEnableLogging | true | Log to file |
| InputPaperTrading | false | false=live, true=paper |

Click **OK** to attach EA.

### Step 4: Configure EA in MT4

**In MT4:**

1. **Tools → Options** (or Ctrl+O)
2. **Expert Advisors** tab
3. Enable **Allow live trading**
4. Enable **Allow DLL imports**
5. Click **OK**

**Now attach the EA:**

1. In MT4 Terminal, select **XAUUSD** in MarketWatch
2. Right-click → **Attach EA to window**
3. Select **GoldRangeBasketR_EA**
4. Input parameters dialog opens

### Step 5: Enter Parameters (MT4)

| Parameter | Value | Description |
|-----------|-------|-------------|
| BotSignalSecret | (paste token) | From AlphaLog Config |
| WebhookSecret | (paste secret) | From AlphaLog Config |
| BotInstanceId | (paste UUID) | From AlphaLog Config |
| MaxLotSize | 10.0 | Max per trade |
| EnableLogging | true | Log to file |
| PaperTradingMode | false | false=live, true=paper |

Click **OK** to attach EA.

---

## 6. Verify EA is Running

### MT5 Verification

1. **Experts** panel should show:
   ```
   GoldRangeBasketR_EA: initialized successfully
   ```

2. Check **Journal** tab (View → Journal):
   ```
   [2026-04-22 14:30:15] EA initialized successfully. Instance: <UUID>
   [2026-04-22 14:30:16] Regime updated: SIDEWAYS_LOW_VOL (confidence: 0.65)
   [2026-04-22 14:30:21] Signal received: BUY (confidence: 0.78)
   ```

3. Monitor **Account History** for trades

### MT4 Verification

1. **Expert Advisors** tab should show:
   ```
   GoldRangeBasketR_EA: initialized successfully
   ```

2. Check **Experts** log:
   ```
   [2026-04-22 14:30:15] EA initialized successfully. Instance: <UUID>
   [2026-04-22 14:30:16] Regime updated: SIDEWAYS_LOW_VOL (confidence: 0.65)
   ```

---

## 7. Troubleshooting

### Issue: "Invalid API credentials"

**Solution:** 
- Copy credentials from AlphaLog correctly (no extra spaces)
- Verify all 3 parameters are set (not empty)

### Issue: "Failed to place BUY order"

**Solution:**
- Check account balance (minimum $1000 recommended)
- Verify lot size calculation is positive
- Check if circuit breaker is triggered

### Issue: "Regime fetch failed"

**Solution:**
- Verify internet connection
- Check firewall allows HTTPS to alphalog.io
- EA will retry automatically every 15 minutes

### Issue: "Signal timeout"

**Solution:**
- Normal during high latency (uses last signal)
- Check network latency: ping alphalog.io
- Consider increasing timeout if >2s latency

### Issue: EA logs empty

**Solution (MT5):**
- Check: **Tools → Journal** tab
- Verify **InputEnableLogging = true**
- Log file: `C:\Users\<user>\AppData\Roaming\MetaQuotes\Terminal\<HASH>\MQL5\Files\GoldRangeBasketR.log`

**Solution (MT4):**
- Check: **Tools → Log file**
- Verify **EnableLogging = true**
- Log file: `C:\Program Files\MetaTrader 4\logs\GoldRangeBasketR.log`

---

## 8. Advanced Configuration

### Custom Stop Loss / Take Profit

Edit the EA source code:

```mql
// Line ~380 in rl-engine section
const int STOP_LOSS_POINTS = 50;     // Change to your preferred SL
const int TAKE_PROFIT_POINTS = 150;  // Change to your preferred TP
```

Recompile after changes.

### Signal Request Interval

Default is 5 seconds. Change:

```mql
const int SIGNAL_REQUEST_INTERVAL = 5;  // Change to 3, 10, etc.
```

**Note:** Faster intervals = higher latency, slower = less responsive to market changes.

### Circuit Breaker Threshold

Default is 5% daily loss:

```mql
const double CIRCUIT_BREAKER_DAILY_LOSS = 0.05;  // 0.05 = 5%, 0.10 = 10%
```

### Session Detection

Default sessions: LONDON (08:00-16:00 UTC), NY (13:00-22:00 UTC)

To modify:
```mql
const int LONDON_OPEN = 8;
const int LONDON_CLOSE = 16;
const int NY_OPEN = 13;
const int NY_CLOSE = 22;
```

---

## 9. Production Deployment Checklist

- [ ] All 3 credentials (Signal Secret, Webhook Secret, Instance ID) configured
- [ ] **InputPaperTrading = false** for live trading
- [ ] **InputMaxLotSize** set appropriately for account size
- [ ] **Circuit breaker threshold** reviewed and tested
- [ ] EA attached to XAUUSD M1 chart
- [ ] Journal shows successful initialization
- [ ] At least one signal received (check Journal)
- [ ] Test trade executed (monitor Experts panel)
- [ ] Trade reported to AlphaLog (check bot_telemetry table)
- [ ] AlphaLog Dashboard shows EA connected (status = "online")
- [ ] Email notification received (if configured)

---

## 10. Monitoring in AlphaLog

### Real-Time Dashboard

1. Go to AlphaLog: **Dashboard → Bot Control**
2. Select your bot instance
3. **Engine DevTools** tab shows:
   - ✅ Regime (BULL/BEAR/SIDEWAYS)
   - ✅ Quantum state (Hamiltonian energy)
   - ✅ Circuit breaker status
   - ✅ Current equity
   - ✅ Kelly fraction

### Telemetry

**Dashboard → Terminal** shows:
- Tick data (bid/ask, volume, positions)
- Last signal (BUY/SELL/SKIP with confidence)
- Regime probability distribution

### Trade History

**Dashboard → TradeHub** shows:
- All trades (live + paper)
- PnL per trade
- Win rate, Sharpe ratio
- P&L chart

---

## 11. Compilation Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Undeclared identifier 'Trade'` | Missing `#include <Trade\Trade.mqh>` | Add at top of MT5 EA |
| `Undeclared identifier 'OrderSend'` | Syntax is MT4, not MT5 | Use Trade class methods |
| `WebRequest not found` | Function not available in older MT5 | Update MT5 to latest build |
| `Memory error` | Too many global variables | Optimize struct sizes |

---

## 12. Testing Checklist

### Unit Tests (Before Live)

- [ ] Send manual test signal to `/api/bot/signal`
- [ ] Test webhook signature verification
- [ ] Verify paper_trades table is updated
- [ ] Check RL learning cycle runs (24h automated)
- [ ] Approve skill in UI after first learning cycle

### Integration Tests

- [ ] EA successfully connects to AlphaLog
- [ ] EA receives signal every 5 seconds
- [ ] EA places buy/sell orders
- [ ] EA closes trades
- [ ] Trades reported via webhook
- [ ] Telemetry updated in real-time

### Live Trading Tests (Small Account)

1. Start with **minimum lot size** (0.01)
2. Run for **1 week** in live market
3. Monitor:
   - Signal quality (confidence, win rate)
   - Execution latency
   - Drawdown vs circuit breaker
   - Webhook success rate
4. Review results in AlphaLog Dashboard
5. Adjust parameters if needed
6. Scale up lot size gradually

---

## 13. Support & Updates

**Documentation:**
- EA Integration Guide: `docs/ea-integration-guide.md`
- Architecture: `docs/bot-intelligence-architecture.md`

**Updates:**
- Check GitHub repository for latest EA versions
- Follow AlphaLog blog for signal engine improvements

**Contact:**
- rivejova2015@gmail.com
- AlphaLog Support: https://alphalog.io/support

---

**IMPORTANT: Start with paper trading mode to verify all integrations before going live.**
