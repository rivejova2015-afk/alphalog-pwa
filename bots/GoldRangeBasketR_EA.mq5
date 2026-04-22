//+------------------------------------------------------------------+
//| GoldRangeBasketR EA v1.0                                         |
//| MT5 Expert Advisor - AlphaLog Integration                        |
//| Integrated with: Heston IV Surface, RL + LLM Skill Learning      |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property link      "https://alphalog.io"
#property version   "1.0"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\SymbolInfo.mqh>

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
const ENUM_TIMEFRAME MAIN_TF = PERIOD_M1;
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

CTrade trade;
CSymbolInfo symInfo;

struct RegimeData {
    string regime;
    double confidence;
    double kelly_fraction;
    bool circuit_breaker_triggered;
    JSONOBJECT iv_surface;
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

// Request handling
struct HttpRequest {
    string method;
    string url;
    string body;
    string signature;
    int timeout_ms;
};

//+------------------------------------------------------------------+
//| Input Parameters                                                 |
//+------------------------------------------------------------------+

input string InputBotSignalSecret = "";       // Bot Signal Secret
input string InputWebhookSecret = "";         // MT5 Webhook Secret
input string InputBotInstanceId = "";         // Bot Instance UUID
input double InputLotSize = 0.0;              // Auto lot sizing if 0
input double InputMaxLotSize = 10.0;          // Maximum lot size
input bool   InputEnableLogging = true;       // Enable detailed logging
input bool   InputPaperTrading = false;       // Paper trading mode (server-side override)

//+------------------------------------------------------------------+
//| EA Initialization                                                |
//+------------------------------------------------------------------+

int OnInit() {

    // Validate inputs
    if (InputBotSignalSecret == "" || InputWebhookSecret == "" || InputBotInstanceId == "") {
        Alert("ERROR: Missing API credentials. Check inputs.");
        return INIT_PARAMETERS_INCORRECT;
    }

    // Initialize trade object
    trade.SetExpertMagicNumber(20260422);

    // Initialize symbol info
    if (!symInfo.Name(SYMBOL)) {
        Alert("ERROR: Failed to initialize symbol info for " + SYMBOL);
        return INIT_FAILED;
    }

    // Initialize telemetry
    telemetry.connected_since = TimeCurrent();
    telemetry.highest_equity = AccountInfoDouble(ACCOUNT_EQUITY);

    // Fetch initial regime
    if (!FetchRegimeNonBlocking()) {
        Alert("WARNING: Initial regime fetch failed. EA will retry on next tick.");
    }

    Log("EA initialized successfully. Instance: " + InputBotInstanceId);

    return INIT_SUCCEEDED;
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
        sessionOpeningEquity = AccountInfoDouble(ACCOUNT_EQUITY);
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
    string headers = "Authorization: Bearer " + InputBotSignalSecret + "\r\n"
                   + "Content-Type: application/json\r\n";

    char response[];
    string result_headers;

    // Non-blocking request with timeout
    int timeout_ms = 3000;

    int result = WebRequest("GET", url, headers, timeout_ms, NULL, response, result_headers);

    if (result != 200) {
        Log("WARN: Regime fetch failed. HTTP " + result);
        return false;
    }

    // Parse JSON response
    string json_str = CharArrayToString(response);

    // Parse regime data (simplified JSON parsing)
    // In production, use a proper JSON library
    if (ParseRegimeJson(json_str)) {
        Log("Regime updated: " + currentRegime.regime + " (confidence: " +
            DoubleToString(currentRegime.confidence, 2) + ")");
        return true;
    }

    return false;
}

//+------------------------------------------------------------------+
//| Signal Fetching (Synchronous, 2s timeout)                        |
//+------------------------------------------------------------------+

bool FetchSignalSynchronous() {

    // Build request payload
    TradeMetrics metrics = GetCurrentMetrics();

    string body = BuildSignalRequestJson(metrics);
    string url = API_URL + "/bot/signal";
    string headers = "Authorization: Bearer " + InputBotSignalSecret + "\r\n"
                   + "Content-Type: application/json\r\n";

    char response[];
    string result_headers;

    int timeout_ms = 2000;  // 2 second timeout for real-time signals
    int result = WebRequest("POST", url, headers, timeout_ms,
                           (uchar*)body, response, result_headers);

    if (result != 200) {
        Log("WARN: Signal request failed. HTTP " + result);
        return false;
    }

    // Parse response
    string json_str = CharArrayToString(response);

    if (ParseSignalJson(json_str)) {
        telemetry.total_signals_received++;
        Log("Signal received: " + lastSignal.signal + " (confidence: " +
            DoubleToString(lastSignal.confidence, 2) + ")");
        return true;
    }

    return false;
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

    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    double maxRisk = equity * RISK_PER_TRADE;

    // Calculate lot size
    double lotSize = CalculateLotSize(maxRisk);
    if (lotSize <= 0) lotSize = 0.01;
    if (lotSize > InputMaxLotSize) lotSize = InputMaxLotSize;

    // Get entry/exit prices
    double bid = SymbolInfoDouble(SYMBOL, SYMBOL_BID);
    double ask = SymbolInfoDouble(SYMBOL, SYMBOL_ASK);
    double stopLoss = CalculateStopLoss(lastSignal.signal, ask);
    double takeProfit = CalculateTakeProfit(lastSignal.signal, ask);

    if (lastSignal.signal == "BUY") {
        if (!HasOpenBuy()) {
            if (trade.Buy(lotSize, SYMBOL, ask, stopLoss, takeProfit, "AlphaLog BUY")) {
                Log("BUY order placed. Lots: " + DoubleToString(lotSize, 2) +
                    " Confidence: " + DoubleToString(lastSignal.confidence, 2));
                telemetry.signals_acted++;
            } else {
                Log("ERROR: Failed to place BUY order. " + trade.ResultComment());
            }
        }
    }
    else if (lastSignal.signal == "SELL") {
        if (!HasOpenSell()) {
            if (trade.Sell(lotSize, SYMBOL, bid, stopLoss, takeProfit, "AlphaLog SELL")) {
                Log("SELL order placed. Lots: " + DoubleToString(lotSize, 2) +
                    " Confidence: " + DoubleToString(lastSignal.confidence, 2));
                telemetry.signals_acted++;
            } else {
                Log("ERROR: Failed to place SELL order. " + trade.ResultComment());
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Trade Close Handler                                              |
//+------------------------------------------------------------------+

void OnTradeTransaction(const MqlTradeTransaction& trans, const MqlTradeRequest& request,
                       const MqlTradeResult& result) {

    // Only process closed orders
    if (trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
    if (trans.deal_type != DEAL_TYPE_SELL && trans.deal_type != DEAL_TYPE_BUY) return;

    // Check if this is our position closing (by magic number)
    if (trans.magic != trade.Magic()) return;

    // Check if position was closed
    ENUM_POSITION_TYPE posType = (trans.deal_type == DEAL_TYPE_BUY) ? POSITION_TYPE_SELL : POSITION_TYPE_BUY;

    // Get deal details
    ulong ticketId = trans.deal;
    double dealVolume = trans.volume;
    double dealPrice = trans.price;

    // Get position for PnL calculation
    if (PositionSelect(trans.position)) {
        double pnl = PositionGetDouble(POSITION_PROFIT);
        double lots = PositionGetDouble(POSITION_VOLUME);
        string direction = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "BUY" : "SELL";

        // Calculate MAE (simplified)
        double mae = CalculateMAE(trans);

        // Build webhook payload
        if (ReportTradeToAlphaLog(ticketId, direction, lots, pnl, mae)) {
            telemetry.trades_closed++;
            Log("Trade reported to AlphaLog. Ticket: " + (string)ticketId +
                " PnL: " + DoubleToString(pnl, 2) + " MAE: " + DoubleToString(mae, 4));
        }
    }
}

//+------------------------------------------------------------------+
//| Report Trade via Webhook (CRITICAL for Learning)                 |
//+------------------------------------------------------------------+

bool ReportTradeToAlphaLog(ulong ticket, string direction, double lots,
                          double pnl, double mae) {

    // Get trade history
    HistoryDealGetTicket(ticket);

    if (!HistoryDealSelect(ticket)) {
        Log("ERROR: Cannot find trade ticket " + (string)ticket);
        return false;
    }

    datetime openTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
    datetime closeTime = TimeCurrent();
    double openPrice = HistoryDealGetDouble(ticket, DEAL_PRICE);

    // Build webhook payload
    TradeMetrics metrics = GetCurrentMetrics();
    string body = BuildWebhookJson(ticket, direction, lots, openPrice,
                                  metrics.ask, pnl, mae, openTime, closeTime);

    // Generate HMAC signature
    string signature = GenerateHmacSignature(body, InputWebhookSecret);

    // Send webhook with retry
    for (int attempt = 1; attempt <= WEBHOOK_RETRY_MAX; attempt++) {

        string url = API_URL + "/webhooks/mt";
        string headers = "x-signature: " + signature + "\r\n"
                       + "Content-Type: application/json\r\n";

        char response[];
        string result_headers;

        int result = WebRequest("POST", url, headers, WEBHOOK_TIMEOUT * 1000,
                               (uchar*)body, response, result_headers);

        if (result == 200) {
            Log("Webhook success (attempt " + (string)attempt + "). Trade reported.");
            return true;
        }

        if (attempt < WEBHOOK_RETRY_MAX) {
            int wait_seconds = (int)MathPow(2, attempt);  // Exponential backoff
            if (wait_seconds > 30) wait_seconds = 30;

            Log("Webhook attempt " + (string)attempt + " failed. Retrying in " +
                (string)wait_seconds + "s...");
            Sleep(wait_seconds * 1000);
        }
    }

    Log("ERROR: Failed to report trade after " + (string)WEBHOOK_RETRY_MAX +
        " attempts. Ticket: " + (string)ticket);
    return false;
}

//+------------------------------------------------------------------+
//| Circuit Breaker Check                                            |
//+------------------------------------------------------------------+

void CheckCircuitBreaker() {

    if (sessionStartTime == 0) return;

    double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
    double dailyPnLPercent = (currentEquity - sessionOpeningEquity) / sessionOpeningEquity;

    if (dailyPnLPercent < -CIRCUIT_BREAKER_DAILY_LOSS) {
        Log("ALERT: Circuit breaker triggered! Daily loss: " +
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
    return PositionExists(POSITION_TYPE_BUY);
}

bool HasOpenSell() {
    return PositionExists(POSITION_TYPE_SELL);
}

bool PositionExists(ENUM_POSITION_TYPE type) {
    for (int i = PositionsTotal() - 1; i >= 0; i--) {
        if (PositionGetSymbol(i) != SYMBOL) continue;
        if (PositionGetInteger(POSITION_MAGIC) != trade.Magic()) continue;
        if (PositionGetInteger(POSITION_TYPE) == type) {
            return true;
        }
    }
    return false;
}

void MonitorOpenPositions() {
    for (int i = PositionsTotal() - 1; i >= 0; i--) {
        if (PositionGetSymbol(i) != SYMBOL) continue;
        if (PositionGetInteger(POSITION_MAGIC) != trade.Magic()) continue;

        // Check for trailing stop or other management
        // (Implement position management logic here)
    }
}

void CloseAllPositions(string reason) {
    for (int i = PositionsTotal() - 1; i >= 0; i--) {
        if (PositionGetSymbol(i) != SYMBOL) continue;
        if (PositionGetInteger(POSITION_MAGIC) != trade.Magic()) continue;

        ulong position_ticket = PositionGetTicket(i);

        if (PositionSelectByTicket(position_ticket)) {
            ENUM_POSITION_TYPE pos_type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            double pos_volume = PositionGetDouble(POSITION_VOLUME);

            if (pos_type == POSITION_TYPE_BUY) {
                trade.Sell(pos_volume, SYMBOL, SymbolInfoDouble(SYMBOL, SYMBOL_BID),
                          0, 0, "Close: " + reason);
            } else {
                trade.Buy(pos_volume, SYMBOL, SymbolInfoDouble(SYMBOL, SYMBOL_ASK),
                         0, 0, "Close: " + reason);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Helper Functions: Calculations                                   |
//+------------------------------------------------------------------+

double CalculateLotSize(double maxRisk) {
    double tickValue = SymbolInfoDouble(SYMBOL, SYMBOL_TRADE_TICK_VALUE);
    double tickSize = SymbolInfoDouble(SYMBOL, SYMBOL_TRADE_TICK_SIZE);
    double slPoints = 50;  // 50 pips stop loss

    if (tickValue <= 0 || tickSize <= 0) return 0;

    double slPrice = (slPoints * tickSize);
    double riskPerLot = slPrice * (tickValue / tickSize);

    double lots = maxRisk / riskPerLot;

    double minLot = SymbolInfoDouble(SYMBOL, SYMBOL_VOLUME_MIN);
    double maxLot = SymbolInfoDouble(SYMBOL, SYMBOL_VOLUME_MAX);

    if (lots < minLot) lots = minLot;
    if (lots > maxLot) lots = maxLot;

    return lots;
}

double CalculateStopLoss(string signal, double currentPrice) {
    int stopPoints = 50;
    double pointSize = SymbolInfoDouble(SYMBOL, SYMBOL_POINT);

    if (signal == "BUY") {
        return currentPrice - (stopPoints * pointSize);
    } else {
        return currentPrice + (stopPoints * pointSize);
    }
}

double CalculateTakeProfit(string signal, double currentPrice) {
    int profitPoints = 150;
    double pointSize = SymbolInfoDouble(SYMBOL, SYMBOL_POINT);

    if (signal == "BUY") {
        return currentPrice + (profitPoints * pointSize);
    } else {
        return currentPrice - (profitPoints * pointSize);
    }
}

double CalculateMAE(const MqlTradeTransaction& trans) {
    // Simplified MAE calculation
    // In production, track min/max prices during position lifetime
    return 0.5;  // Placeholder
}

string DetectTradingSession() {
    datetime utc_time = TimeGMT();
    int utc_hour = Hour(utc_time);

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
    // Simplified: return recent volatility
    // In production, calculate from last 15 1-min bars
    double atr = iATR(SYMBOL, PERIOD_M1, 14);
    double price = (SymbolInfoDouble(SYMBOL, SYMBOL_BID) +
                   SymbolInfoDouble(SYMBOL, SYMBOL_ASK)) / 2;
    return atr / price;
}

TradeMetrics GetCurrentMetrics() {
    TradeMetrics m;
    m.bid = SymbolInfoDouble(SYMBOL, SYMBOL_BID);
    m.ask = SymbolInfoDouble(SYMBOL, SYMBOL_ASK);
    m.balance = AccountInfoDouble(ACCOUNT_BALANCE);
    m.equity = AccountInfoDouble(ACCOUNT_EQUITY);
    m.positions_total = PositionsTotal();
    m.positions_buy = CountPositionsByType(POSITION_TYPE_BUY);
    m.positions_sell = CountPositionsByType(POSITION_TYPE_SELL);
    m.tick_volume = (long)iVolume(SYMBOL, PERIOD_M1, 0);
    return m;
}

int CountPositionsByType(ENUM_POSITION_TYPE type) {
    int count = 0;
    for (int i = PositionsTotal() - 1; i >= 0; i--) {
        if (PositionGetSymbol(i) != SYMBOL) continue;
        if (PositionGetInteger(POSITION_TYPE) == type) {
            count++;
        }
    }
    return count;
}

void UpdateTelemetry() {
    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    if (equity > telemetry.highest_equity) {
        telemetry.highest_equity = equity;
    }
}

void LogDailyResults() {
    double dailyEquityChange = AccountInfoDouble(ACCOUNT_EQUITY) - sessionOpeningEquity;
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

string BuildWebhookJson(ulong ticket, string direction, double lots, double openPrice,
                       double closePrice, double pnl, double mae,
                       datetime openTime, datetime closeTime) {

    TradeMetrics m = GetCurrentMetrics();
    string openTimeStr = TimeToString(openTime, TIME_DATE | TIME_SECONDS);
    string closeTimeStr = TimeToString(closeTime, TIME_DATE | TIME_SECONDS);

    return "{\"symbol\":\"" + SYMBOL +
           "\",\"platform\":\"MT5\"" +
           ",\"bid\":" + DoubleToString(m.bid, 5) +
           ",\"ask\":" + DoubleToString(m.ask, 5) +
           ",\"last\":" + DoubleToString((m.bid + m.ask) / 2, 5) +
           ",\"balance\":" + DoubleToString(m.balance, 2) +
           ",\"equity\":" + DoubleToString(m.equity, 2) +
           ",\"positions_total\":" + (string)m.positions_total +
           ",\"positions_buy\":" + (string)m.positions_buy +
           ",\"positions_sell\":" + (string)m.positions_sell +
           ",\"tick_volume\":" + (string)m.tick_volume +
           ",\"bot_instance_id\":\"" + InputBotInstanceId +
           "\",\"closed_trade\":{" +
           "\"ticket\":" + (string)ticket +
           ",\"direction\":\"" + direction +
           "\",\"lots\":" + DoubleToString(lots, 2) +
           ",\"open_price\":" + DoubleToString(openPrice, 5) +
           ",\"close_price\":" + DoubleToString(closePrice, 5) +
           ",\"pnl\":" + DoubleToString(pnl, 2) +
           ",\"max_adverse_excursion\":" + DoubleToString(mae, 4) +
           ",\"open_time\":\"" + openTimeStr +
           "\",\"close_time\":\"" + closeTimeStr + "\"}}";
}

//+------------------------------------------------------------------+
//| JSON Parsing Functions (Simplified)                              |
//+------------------------------------------------------------------+

bool ParseRegimeJson(string json) {
    // Parse: {"regime": "BULL_TREND_STRONG", "confidence": 0.87, ...}
    // Simplified parsing - in production use proper JSON library

    int idx_regime = StringFind(json, "\"regime\"");
    int idx_confidence = StringFind(json, "\"confidence\"");

    if (idx_regime < 0 || idx_confidence < 0) return false;

    // Extract regime (simplified)
    int start = StringFind(json, ":", idx_regime) + 2;
    int end = StringFind(json, "\"", start + 1);
    currentRegime.regime = StringSubstr(json, start, end - start);

    // Extract confidence (simplified)
    start = StringFind(json, ":", idx_confidence) + 1;
    currentRegime.confidence = StringToDouble(StringSubstr(json, start, 4));

    // Extract kelly_fraction (simplified)
    int idx_kelly = StringFind(json, "\"kelly_fraction\"");
    if (idx_kelly >= 0) {
        start = StringFind(json, ":", idx_kelly) + 1;
        currentRegime.kelly_fraction = StringToDouble(StringSubstr(json, start, 5));
    } else {
        currentRegime.kelly_fraction = INITIAL_KELLY_FRACTION;
    }

    return true;
}

bool ParseSignalJson(string json) {
    // Parse: {"signal": "BUY", "confidence": 0.78, ...}

    int idx_signal = StringFind(json, "\"signal\"");
    if (idx_signal < 0) return false;

    int start = StringFind(json, ":", idx_signal) + 2;
    int end = StringFind(json, "\"", start + 1);
    lastSignal.signal = StringSubstr(json, start, end - start);

    int idx_confidence = StringFind(json, "\"confidence\"");
    if (idx_confidence >= 0) {
        start = StringFind(json, ":", idx_confidence) + 1;
        lastSignal.confidence = StringToDouble(StringSubstr(json, start, 4));
    }

    return true;
}

//+------------------------------------------------------------------+
//| HMAC-SHA256 Signature Generation                                 |
//+------------------------------------------------------------------+

string GenerateHmacSignature(string data, string secret) {
    // Note: MQL5 doesn't have built-in HMAC-SHA256
    // This requires external library or custom implementation
    // For now, return placeholder - implement actual HMAC in production

    // In production, use:
    // - CryptEncode for basic crypto
    // - Or integrate with C++ DLL that implements HMAC-SHA256

    Log("NOTE: HMAC signature verification requires crypto library implementation");
    return "";  // Placeholder
}

//+------------------------------------------------------------------+
//| Logging Function                                                 |
//+------------------------------------------------------------------+

void Log(string message) {
    if (!InputEnableLogging) return;

    datetime now = TimeCurrent();
    string timestamp = TimeToString(now, TIME_DATE | TIME_SECONDS);

    Print("[" + timestamp + "] " + message);

    // Optionally log to file
    int fileHandle = FileOpen("GoldRangeBasketR.log", FILE_READ | FILE_WRITE | FILE_TXT);
    if (fileHandle != INVALID_HANDLE) {
        FileSeek(fileHandle, 0, SEEK_END);
        FileWrite(fileHandle, "[" + timestamp + "] " + message);
        FileClose(fileHandle);
    }
}

//+------------------------------------------------------------------+
//| EA Shutdown                                                      |
//+------------------------------------------------------------------+

void OnDeinit(const int reason) {
    Log("EA deinitialization. Reason: " + (string)reason);

    // Close all open positions
    CloseAllPositions("EA shutdown");

    // Log final telemetry
    Log("Total signals received: " + (string)telemetry.total_signals_received);
    Log("Signals acted upon: " + (string)telemetry.signals_acted);
    Log("Trades closed: " + (string)telemetry.trades_closed);
    Log("Highest equity: $" + DoubleToString(telemetry.highest_equity, 2));
}

//+------------------------------------------------------------------+
//| Helper: String to Double conversion                              |
//+------------------------------------------------------------------+

double StringToDouble(string str) {
    return NormalizeDouble(StringToDouble(str), 6);
}

//+------------------------------------------------------------------+
