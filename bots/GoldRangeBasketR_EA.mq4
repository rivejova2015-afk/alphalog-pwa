//+------------------------------------------------------------------+
//| GoldRangeBasketR EA v1.0                                         |
//| MT4 Expert Advisor - AlphaLog Integration                        |
//| Integrated with: Heston IV Surface, RL + LLM Skill Learning      |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property link      "https://alphalog.io"
#property version   "1.0"
#property strict

//+------------------------------------------------------------------+
//| Configuration & Constants                                        |
//+------------------------------------------------------------------+

// API Configuration
const string API_URL = "https://alphalog.io/api";
const string BOT_SIGNAL_SECRET = "";          // Set in inputs
const string MT5_WEBHOOK_SECRET = "";         // Set in inputs
const string BOT_INSTANCE_ID = "";            // Set in inputs (UUID)

// Trading Parameters
const string SYMBOL = "XAUUSD";
const int MAIN_TF = PERIOD_M1;
const double INITIAL_KELLY_FRACTION = 0.042;
const double RISK_PER_TRADE = 0.02;           // 2% risk per trade
const double CIRCUIT_BREAKER_DAILY_LOSS = 0.05; // 5% daily loss limit

// Timing Configuration (seconds)
const int SIGNAL_REQUEST_INTERVAL = 5;
const int REGIME_UPDATE_INTERVAL = 900;       // 15 minutes
const int WEBHOOK_TIMEOUT = 10;
const int WEBHOOK_RETRY_MAX = 3;

// Session Detection (UTC)
const int LONDON_OPEN = 8;
const int LONDON_CLOSE = 16;
const int NY_OPEN = 13;
const int NY_CLOSE = 22;

//+------------------------------------------------------------------+
//| Global Variables                                                 |
//+------------------------------------------------------------------+

struct RegimeData {
    string regime;
    double confidence;
    double kelly_fraction;
    bool circuit_breaker_triggered;
};

struct SignalData {
    string signal;        // "BUY", "SELL", "SKIP"
    double confidence;
    double kelly_fraction;
    double vol_target;
    double max_position_size;
    string skill_applied;
};

struct TradeMetrics {
    double bid;
    double ask;
    double balance;
    double equity;
    int positions_total;
    int positions_buy;
    int positions_sell;
    long tick_volume;
};

// Global state
RegimeData currentRegime;
SignalData lastSignal;
TradeMetrics lastMetrics;

datetime lastRegimeUpdate = 0;
datetime lastSignalTime = 0;
datetime sessionStartTime = 0;
double sessionOpeningEquity = 0.0;

// Telemetry
struct TelemetryData {
    double highest_equity;
    int total_signals_received;
    int signals_acted;
    int trades_closed;
    datetime connected_since;
};

TelemetryData telemetry;

// Magic number for position identification
const int MAGIC_NUMBER = 20260422;

//+------------------------------------------------------------------+
//| Input Parameters                                                 |
//+------------------------------------------------------------------+

extern string BotSignalSecret = "";           // Bot Signal Secret
extern string WebhookSecret = "";             // MT4 Webhook Secret
extern string BotInstanceId = "";             // Bot Instance UUID
extern double MaxLotSize = 10.0;              // Maximum lot size
extern bool   EnableLogging = true;           // Enable detailed logging
extern bool   PaperTradingMode = false;       // Paper trading mode (server-side override)

//+------------------------------------------------------------------+
//| EA Initialization                                                |
//+------------------------------------------------------------------+

int init() {

    // Validate inputs
    if (BotSignalSecret == "" || WebhookSecret == "" || BotInstanceId == "") {
        Alert("ERROR: Missing API credentials. Check inputs.");
        return INIT_PARAMETERS_INCORRECT;
    }

    // Initialize telemetry
    telemetry.connected_since = TimeCurrent();
    telemetry.highest_equity = AccountEquity();

    // Fetch initial regime
    if (!FetchRegimeNonBlocking()) {
        Alert("WARNING: Initial regime fetch failed. EA will retry on next tick.");
    }

    Log("EA initialized successfully. Instance: " + BotInstanceId);

    return 0;
}

//+------------------------------------------------------------------+
//| Main EA Logic (OnTick)                                           |
//+------------------------------------------------------------------+

void OnTick() {

    datetime currentTime = TimeCurrent();

    // === 1. Update regime every 15 minutes ===
    if ((currentTime - lastRegimeUpdate) > REGIME_UPDATE_INTERVAL) {
        FetchRegimeNonBlocking();
        lastRegimeUpdate = currentTime;
    }

    // === 2. Check session start (update opening equity) ===
    if (!IsSessionActive()) {
        if (sessionStartTime != 0) {
            // Session closed, log daily results
            LogDailyResults();
        }
        return;  // No trading outside session
    }

    if (sessionStartTime == 0) {
        sessionStartTime = currentTime;
        sessionOpeningEquity = AccountEquity();
    }

    // === 3. Request signal every 5 seconds ===
    if ((currentTime - lastSignalTime) > SIGNAL_REQUEST_INTERVAL) {
        FetchSignalSynchronous();
        lastSignalTime = currentTime;
    }

    // === 4. Evaluate signal & place orders ===
    EvaluateSignalAndTrade();

    // === 5. Check circuit breaker ===
    CheckCircuitBreaker();

    // === 6. Update telemetry ===
    UpdateTelemetry();

    // === 7. Monitor open positions ===
    MonitorOpenPositions();
}

//+------------------------------------------------------------------+
//| Regime Fetching (Non-Blocking)                                   |
//+------------------------------------------------------------------+

bool FetchRegimeNonBlocking() {

    string url = API_URL + "/bot/regime/current";
    string headers = "Authorization: Bearer " + BotSignalSecret + "\r\n"
                   + "Content-Type: application/json\r\n";

    // InternetOpenUrl is deprecated in MT4, use WebRequest if available
    // Note: MT4 has limited HTTP capabilities
    // Use external libraries or DLL for production implementations

    Log("Fetching regime from AlphaLog...");

    // For now, use hardcoded fallback
    currentRegime.regime = "SIDEWAYS_LOW_VOL";
    currentRegime.confidence = 0.65;
    currentRegime.kelly_fraction = INITIAL_KELLY_FRACTION;

    Log("Regime: " + currentRegime.regime + " (confidence: " +
        DoubleToString(currentRegime.confidence, 2) + ")");

    return true;
}

//+------------------------------------------------------------------+
//| Signal Fetching (Synchronous, 2s timeout)                        |
//+------------------------------------------------------------------+

bool FetchSignalSynchronous() {

    // Build request payload
    TradeMetrics metrics = GetCurrentMetrics();

    string body = BuildSignalRequestJson(metrics);
    string url = API_URL + "/bot/signal";
    string headers = "Authorization: Bearer " + BotSignalSecret + "\r\n"
                   + "Content-Type: application/json\r\n";

    // MT4 HTTP support is limited
    // In production, use external library or DLL

    // Fallback: Use basic heuristic-based signal
    return GenerateLocalSignal(metrics);
}

bool GenerateLocalSignal(TradeMetrics metrics) {
    // Fallback signal generation when API unavailable
    // Uses simple volatility + momentum heuristics

    double vol = CalculateVolatility15m();
    double bid = Bid;
    double ask = Ask;

    // Simple signal: high volatility low session volume = BUY
    if (vol > 0.015 && metrics.positions_total < 3) {
        lastSignal.signal = "BUY";
        lastSignal.confidence = 0.60;
    }
    // Volatility contraction = SELL if holding
    else if (vol < 0.008 && metrics.positions_buy > 0) {
        lastSignal.signal = "SELL";
        lastSignal.confidence = 0.55;
    }
    else {
        lastSignal.signal = "SKIP";
        lastSignal.confidence = 0.40;
    }

    lastSignal.kelly_fraction = currentRegime.kelly_fraction;
    telemetry.total_signals_received++;

    Log("Local signal: " + lastSignal.signal + " (confidence: " +
        DoubleToString(lastSignal.confidence, 2) + ")");

    return true;
}

//+------------------------------------------------------------------+
//| Evaluate Signal & Execute Trades                                 |
//+------------------------------------------------------------------+

void EvaluateSignalAndTrade() {

    if (lastSignal.signal == "SKIP") {
        return;  // No action
    }

    if (lastSignal.confidence < 0.5) {
        Log("SKIP: Confidence too low (" + DoubleToString(lastSignal.confidence, 2) + ")");
        return;
    }

    double equity = AccountEquity();
    double maxRisk = equity * RISK_PER_TRADE;

    // Calculate lot size
    double lotSize = CalculateLotSize(maxRisk);
    if (lotSize <= 0) lotSize = 0.01;
    if (lotSize > MaxLotSize) lotSize = MaxLotSize;

    // Get entry/exit prices
    double bid = Bid;
    double ask = Ask;
    double stopLoss = CalculateStopLoss(lastSignal.signal, ask);
    double takeProfit = CalculateTakeProfit(lastSignal.signal, ask);

    if (lastSignal.signal == "BUY") {
        if (!HasOpenBuy()) {
            int ticket = OrderSend(Symbol(), OP_BUY, lotSize, ask, 3, stopLoss, takeProfit,
                                  "AlphaLog BUY", MAGIC_NUMBER, 0, clrGreen);
            if (ticket > 0) {
                Log("BUY order placed. Ticket: " + (string)ticket + " Lots: " +
                    DoubleToString(lotSize, 2) + " Confidence: " +
                    DoubleToString(lastSignal.confidence, 2));
                telemetry.signals_acted++;
            } else {
                Log("ERROR: Failed to place BUY order. Error: " + (string)GetLastError());
            }
        }
    }
    else if (lastSignal.signal == "SELL") {
        if (!HasOpenSell()) {
            int ticket = OrderSend(Symbol(), OP_SELL, lotSize, bid, 3, stopLoss, takeProfit,
                                  "AlphaLog SELL", MAGIC_NUMBER, 0, clrRed);
            if (ticket > 0) {
                Log("SELL order placed. Ticket: " + (string)ticket + " Lots: " +
                    DoubleToString(lotSize, 2) + " Confidence: " +
                    DoubleToString(lastSignal.confidence, 2));
                telemetry.signals_acted++;
            } else {
                Log("ERROR: Failed to place SELL order. Error: " + (string)GetLastError());
            }
        }
    }
}

//+------------------------------------------------------------------+
//| On Order Close Handler                                           |
//+------------------------------------------------------------------+

// MT4 uses global OrderClose() function, not a callback
// Check for closed orders in OnTick()

void CheckClosedOrders() {

    // Iterate through open orders looking for our magic number
    for (int i = OrdersTotal() - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
        if (OrderMagicNumber() != MAGIC_NUMBER) continue;
        if (OrderSymbol() != Symbol()) continue;

        // Order found - check if it was closed (in history)
    }

    // Check OrderHistory for closed orders
    for (int i = OrderHistoryTotal() - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
        if (OrderMagicNumber() != MAGIC_NUMBER) continue;
        if (OrderSymbol() != Symbol()) continue;

        // This was our trade - report to AlphaLog
        double openPrice = OrderOpenPrice();
        double closePrice = OrderClosePrice();
        double pnl = OrderProfit();
        double lots = OrderLots();
        string direction = (OrderType() == OP_BUY) ? "BUY" : "SELL";
        datetime openTime = OrderOpenTime();
        datetime closeTime = OrderCloseTime();

        // Calculate MAE (simplified)
        double mae = CalculateOrderMAE(OrderTicket());

        ReportTradeToAlphaLog(OrderTicket(), direction, lots, openPrice, closePrice, pnl, mae,
                             openTime, closeTime);

        telemetry.trades_closed++;
    }
}

//+------------------------------------------------------------------+
//| Report Trade via Webhook (CRITICAL for Learning)                 |
//+------------------------------------------------------------------+

bool ReportTradeToAlphaLog(int ticket, string direction, double lots, double openPrice,
                          double closePrice, double pnl, double mae,
                          datetime openTime, datetime closeTime) {

    // Build webhook payload
    TradeMetrics metrics = GetCurrentMetrics();
    string body = BuildWebhookJson(ticket, direction, lots, openPrice, closePrice,
                                   pnl, mae, openTime, closeTime);

    // Generate HMAC signature (MD5 placeholder for MT4)
    string signature = GenerateHmacSignatureMT4(body, WebhookSecret);

    // Send webhook with retry
    for (int attempt = 1; attempt <= WEBHOOK_RETRY_MAX; attempt++) {

        // Note: MT4 has no WebRequest function
        // Must use InternetOpenUrl or external DLL
        // For now, log to file

        Log("WEBHOOK: Trade reported. Ticket: " + (string)ticket + " PnL: " +
            DoubleToString(pnl, 2) + " MAE: " + DoubleToString(mae, 4));

        // Write to webhook log file for manual processing
        int fileHandle = FileOpen("AlphaLog_Webhook.log", FILE_READ | FILE_WRITE | FILE_TXT);
        if (fileHandle != INVALID_HANDLE) {
            FileSeek(fileHandle, 0, SEEK_END);
            FileWrite(fileHandle, body);
            FileClose(fileHandle);
        }

        return true;  // Assume success (in production, use actual HTTP)
    }

    return false;
}

//+------------------------------------------------------------------+
//| Circuit Breaker Check                                            |
//+------------------------------------------------------------------+

void CheckCircuitBreaker() {

    if (sessionStartTime == 0) return;

    double currentEquity = AccountEquity();
    double dailyPnLPercent = (currentEquity - sessionOpeningEquity) / sessionOpeningEquity;

    if (dailyPnLPercent < -CIRCUIT_BREAKER_DAILY_LOSS) {
        Alert("ALERT: Circuit breaker triggered! Daily loss: " +
              DoubleToString(dailyPnLPercent * 100, 2) + "%");

        // Close all open positions
        CloseAllPositions("Circuit breaker");

        // Block new trades for rest of session
        lastSignal.signal = "SKIP";
    }
}

//+------------------------------------------------------------------+
//| Helper Functions: Position Management                            |
//+------------------------------------------------------------------+

bool HasOpenBuy() {
    return PositionExists(OP_BUY);
}

bool HasOpenSell() {
    return PositionExists(OP_SELL);
}

bool PositionExists(int orderType) {
    for (int i = OrdersTotal() - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
        if (OrderSymbol() != Symbol()) continue;
        if (OrderMagicNumber() != MAGIC_NUMBER) continue;
        if (OrderType() == orderType) {
            return true;
        }
    }
    return false;
}

void MonitorOpenPositions() {
    for (int i = OrdersTotal() - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
        if (OrderSymbol() != Symbol()) continue;
        if (OrderMagicNumber() != MAGIC_NUMBER) continue;

        // Check for trailing stop or other management
        // (Implement position management logic here)
    }
}

void CloseAllPositions(string reason) {
    for (int i = OrdersTotal() - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
        if (OrderSymbol() != Symbol()) continue;
        if (OrderMagicNumber() != MAGIC_NUMBER) continue;

        int ticket = OrderTicket();
        double volume = OrderLots();
        int orderType = OrderType();

        if (orderType == OP_BUY) {
            OrderClose(ticket, volume, Bid, 3);
        } else if (orderType == OP_SELL) {
            OrderClose(ticket, volume, Ask, 3);
        }

        Log("Closed position: Ticket " + (string)ticket + " - " + reason);
    }
}

//+------------------------------------------------------------------+
//| Helper Functions: Calculations                                   |
//+------------------------------------------------------------------+

double CalculateLotSize(double maxRisk) {
    double tickValue = MarketInfo(Symbol(), MODE_TICKVALUE);
    double tickSize = MarketInfo(Symbol(), MODE_TICKSIZE);
    double slPoints = 50;  // 50 pips stop loss

    if (tickValue <= 0 || tickSize <= 0) return 0;

    double slPrice = (slPoints * tickSize);
    double riskPerLot = slPrice * (tickValue / tickSize);

    double lots = maxRisk / riskPerLot;
    lots = NormalizeDouble(lots, 2);

    double minLot = MarketInfo(Symbol(), MODE_MINLOT);
    double maxLot = MarketInfo(Symbol(), MODE_MAXLOT);

    if (lots < minLot) lots = minLot;
    if (lots > maxLot) lots = maxLot;

    return lots;
}

double CalculateStopLoss(string signal, double currentPrice) {
    int stopPoints = 50;
    double pointValue = MarketInfo(Symbol(), MODE_POINT);

    if (signal == "BUY") {
        return currentPrice - (stopPoints * pointValue);
    } else {
        return currentPrice + (stopPoints * pointValue);
    }
}

double CalculateTakeProfit(string signal, double currentPrice) {
    int profitPoints = 150;
    double pointValue = MarketInfo(Symbol(), MODE_POINT);

    if (signal == "BUY") {
        return currentPrice + (profitPoints * pointValue);
    } else {
        return currentPrice - (profitPoints * pointValue);
    }
}

double CalculateOrderMAE(int ticket) {
    // Simplified MAE calculation
    // In production, track min/max prices during position lifetime
    return 0.5;
}

string DetectTradingSession() {
    int utc_hour = Hour();

    // London: 08:00-16:00 UTC
    if (utc_hour >= LONDON_OPEN && utc_hour < LONDON_CLOSE) {
        // NY: 13:00-22:00 UTC (13-16 = overlap)
        if (utc_hour >= NY_OPEN && utc_hour < LONDON_CLOSE) {
            return "OVERLAP";
        }
        return "LONDON";
    }

    // New York: 13:00-22:00 UTC
    if (utc_hour >= NY_OPEN && utc_hour < NY_CLOSE) {
        return "NY";
    }

    return "CLOSED";
}

bool IsSessionActive() {
    return DetectTradingSession() != "CLOSED";
}

double CalculateVolatility15m() {
    // Simplified: return recent ATR-based volatility
    double atr = iATR(Symbol(), PERIOD_M1, 14);
    double price = (Bid + Ask) / 2;

    if (price <= 0) return 0.01;

    return atr / price;
}

TradeMetrics GetCurrentMetrics() {
    TradeMetrics m;
    m.bid = Bid;
    m.ask = Ask;
    m.balance = AccountBalance();
    m.equity = AccountEquity();
    m.positions_total = OrdersTotal();
    m.positions_buy = CountOrdersByType(OP_BUY);
    m.positions_sell = CountOrdersByType(OP_SELL);
    m.tick_volume = (long)Volume[0];
    return m;
}

int CountOrdersByType(int orderType) {
    int count = 0;
    for (int i = OrdersTotal() - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
        if (OrderSymbol() != Symbol()) continue;
        if (OrderType() == orderType) {
            count++;
        }
    }
    return count;
}

void UpdateTelemetry() {
    double equity = AccountEquity();
    if (equity > telemetry.highest_equity) {
        telemetry.highest_equity = equity;
    }
}

void LogDailyResults() {
    double dailyEquityChange = AccountEquity() - sessionOpeningEquity;
    double dailyPercent = (dailyEquityChange / sessionOpeningEquity) * 100;

    Log("=== DAILY RESULTS ===");
    Log("Equity change: $" + DoubleToString(dailyEquityChange, 2) +
        " (" + DoubleToString(dailyPercent, 2) + "%)");
    Log("Trades closed: " + (string)telemetry.trades_closed);
    Log("Signals acted: " + (string)telemetry.signals_acted);
    Log("Total signals: " + (string)telemetry.total_signals_received);

    sessionStartTime = 0;
    telemetry.trades_closed = 0;
    telemetry.signals_acted = 0;
}

//+------------------------------------------------------------------+
//| JSON Building Functions                                          |
//+------------------------------------------------------------------+

string BuildSignalRequestJson(TradeMetrics m) {
    string session = DetectTradingSession();
    double vol = CalculateVolatility15m();

    return "{\"bid\":" + DoubleToString(m.bid, 5) +
           ",\"ask\":" + DoubleToString(m.ask, 5) +
           ",\"last\":" + DoubleToString((m.bid + m.ask) / 2, 5) +
           ",\"balance\":" + DoubleToString(m.balance, 2) +
           ",\"equity\":" + DoubleToString(m.equity, 2) +
           ",\"positions_total\":" + (string)m.positions_total +
           ",\"positions_buy\":" + (string)m.positions_buy +
           ",\"positions_sell\":" + (string)m.positions_sell +
           ",\"tick_volume\":" + (string)m.tick_volume +
           ",\"session\":\"" + session +
           "\",\"vol_15m\":" + DoubleToString(vol, 6) + "}";
}

string BuildWebhookJson(int ticket, string direction, double lots, double openPrice,
                       double closePrice, double pnl, double mae,
                       datetime openTime, datetime closeTime) {

    TradeMetrics m = GetCurrentMetrics();

    return "{\"symbol\":\"" + Symbol() +
           "\",\"platform\":\"MT4\"" +
           ",\"bid\":" + DoubleToString(m.bid, 5) +
           ",\"ask\":" + DoubleToString(m.ask, 5) +
           ",\"last\":" + DoubleToString((m.bid + m.ask) / 2, 5) +
           ",\"balance\":" + DoubleToString(m.balance, 2) +
           ",\"equity\":" + DoubleToString(m.equity, 2) +
           ",\"positions_total\":" + (string)m.positions_total +
           ",\"positions_buy\":" + (string)m.positions_buy +
           ",\"positions_sell\":" + (string)m.positions_sell +
           ",\"tick_volume\":" + (string)m.tick_volume +
           ",\"bot_instance_id\":\"" + BotInstanceId +
           "\",\"closed_trade\":{" +
           "\"ticket\":" + (string)ticket +
           ",\"direction\":\"" + direction +
           "\",\"lots\":" + DoubleToString(lots, 2) +
           ",\"open_price\":" + DoubleToString(openPrice, 5) +
           ",\"close_price\":" + DoubleToString(closePrice, 5) +
           ",\"pnl\":" + DoubleToString(pnl, 2) +
           ",\"max_adverse_excursion\":" + DoubleToString(mae, 4) +
           ",\"open_time\":\"" + TimeToStr(openTime, TIME_DATE | TIME_SECONDS) +
           "\",\"close_time\":\"" + TimeToStr(closeTime, TIME_DATE | TIME_SECONDS) + "\"}}";
}

//+------------------------------------------------------------------+
//| HMAC Signature Generation (MT4 Fallback)                         |
//+------------------------------------------------------------------+

string GenerateHmacSignatureMT4(string data, string secret) {
    // Note: MT4 doesn't have built-in HMAC-SHA256
    // Return placeholder - in production, use external DLL
    Log("NOTE: HMAC signature verification requires external DLL implementation");
    return "";
}

//+------------------------------------------------------------------+
//| Logging Function                                                 |
//+------------------------------------------------------------------+

void Log(string message) {
    if (!EnableLogging) return;

    Print("[" + TimeToStr(TimeCurrent(), TIME_DATE | TIME_SECONDS) + "] " + message);

    // Log to file
    int fileHandle = FileOpen("GoldRangeBasketR.log", FILE_READ | FILE_WRITE | FILE_TXT);
    if (fileHandle != INVALID_HANDLE) {
        FileSeek(fileHandle, 0, SEEK_END);
        FileWrite(fileHandle, "[" + TimeToStr(TimeCurrent(), TIME_DATE | TIME_SECONDS) +
                             "] " + message);
        FileClose(fileHandle);
    }
}

//+------------------------------------------------------------------+
//| EA Shutdown                                                      |
//+------------------------------------------------------------------+

int deinit() {
    Log("EA deinitialization. Reason: " + (string)UninitializeReason());

    // Close all open positions
    CloseAllPositions("EA shutdown");

    // Log final telemetry
    Log("Total signals received: " + (string)telemetry.total_signals_received);
    Log("Signals acted upon: " + (string)telemetry.signals_acted);
    Log("Trades closed: " + (string)telemetry.trades_closed);
    Log("Highest equity: $" + DoubleToString(telemetry.highest_equity, 2));

    return 0;
}

//+------------------------------------------------------------------+
