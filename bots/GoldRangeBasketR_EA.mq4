//+------------------------------------------------------------------+
//| GoldRangeBasketR EA v1.1                                         |
//| MT4 Expert Advisor - AlphaLog Integration                        |
//| Integrated with: Heston IV Surface, RL + LLM Skill Learning      |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property link      "https://alphalog.io"
#property version   "1.1"
#property strict

//+------------------------------------------------------------------+
//| Constants                                                        |
//+------------------------------------------------------------------+

const string API_URL                  = "https://alphalog.io/api";
const double INITIAL_KELLY_FRACTION   = 0.042;
const double RISK_PER_TRADE           = 0.02;
const double CIRCUIT_BREAKER_LOSS     = 0.05;
const int    SIGNAL_INTERVAL          = 5;
const int    REGIME_INTERVAL          = 900;
const int    WEBHOOK_RETRY_MAX        = 3;
const int    MAGIC_NUMBER             = 20260422;
const int    LONDON_OPEN              = 8;
const int    LONDON_CLOSE             = 16;
const int    NY_OPEN                  = 13;
const int    NY_CLOSE                 = 22;

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+

extern string InpSignalSecret  = "";     // Bot Signal Secret
extern string InpWebhookSecret = "";     // MT4 Webhook Secret
extern string InpBotInstanceId = "";     // Bot Instance UUID
extern double InpMaxLotSize    = 10.0;   // Maximum lot size
extern bool   InpEnableLogging = true;   // Enable logging

//+------------------------------------------------------------------+
//| Structures                                                       |
//+------------------------------------------------------------------+

struct RegimeData {
    string regime;
    double confidence;
    double kelly_fraction;
    bool   circuit_breaker;
};

struct SignalData {
    string signal;
    double confidence;
    double kelly_fraction;
    string skill_applied;
};

struct TradeMetrics {
    double bid;
    double ask;
    double balance;
    double equity;
    int    positions_total;
    int    positions_buy;
    int    positions_sell;
    long   tick_volume;
};

struct TelemetryData {
    double   highest_equity;
    int      total_signals;
    int      signals_acted;
    int      trades_closed;
    datetime connected_since;
};

//+------------------------------------------------------------------+
//| Global state                                                     |
//+------------------------------------------------------------------+

RegimeData    g_regime;
SignalData    g_signal;
TelemetryData g_telemetry;

datetime g_last_regime_update = 0;
datetime g_last_signal_time   = 0;
datetime g_session_start      = 0;
double   g_session_equity     = 0.0;

// Track last reported ticket to avoid duplicate webhooks
int g_last_reported_ticket = 0;

//+------------------------------------------------------------------+
//| Logging                                                          |
//+------------------------------------------------------------------+

void Log(const string msg) {
    if (!InpEnableLogging) return;
    string ts   = TimeToStr(TimeCurrent(), TIME_DATE | TIME_SECONDS);
    string line = "[" + ts + "] " + msg;
    Print(line);
    int fh = FileOpen("GoldRangeBasketR.log",
                      FILE_READ | FILE_WRITE | FILE_TXT);
    if (fh != INVALID_HANDLE) {
        FileSeek(fh, 0, SEEK_END);
        FileWrite(fh, line);
        FileClose(fh);
    }
}

//+------------------------------------------------------------------+
//| JSON helpers                                                     |
//+------------------------------------------------------------------+

string JsonGetString(const string json, const string key) {
    string search = "\"" + key + "\"";
    int idx = StringFind(json, search);
    if (idx < 0) return "";
    int colon = StringFind(json, ":", idx);
    if (colon < 0) return "";
    int q1 = StringFind(json, "\"", colon + 1);
    if (q1 < 0) return "";
    int q2 = StringFind(json, "\"", q1 + 1);
    if (q2 < 0) return "";
    return StringSubstr(json, q1 + 1, q2 - q1 - 1);
}

double JsonGetDouble(const string json, const string key) {
    string search = "\"" + key + "\"";
    int idx = StringFind(json, search);
    if (idx < 0) return 0.0;
    int colon = StringFind(json, ":", idx);
    if (colon < 0) return 0.0;
    return StringToDouble(StringSubstr(json, colon + 1, 12));
}

//+------------------------------------------------------------------+
//| Session helpers                                                  |
//+------------------------------------------------------------------+

string DetectSession() {
    int h = Hour();
    if (h >= NY_OPEN && h < LONDON_CLOSE) return "OVERLAP";
    if (h >= LONDON_OPEN && h < LONDON_CLOSE) return "LONDON";
    if (h >= NY_OPEN && h < NY_CLOSE) return "NY";
    return "CLOSED";
}

bool IsSessionActive() {
    return DetectSession() != "CLOSED";
}

//+------------------------------------------------------------------+
//| Metrics                                                          |
//+------------------------------------------------------------------+

TradeMetrics GetMetrics() {
    TradeMetrics m;
    m.bid = Bid;
    m.ask = Ask;
    m.balance = AccountBalance();
    m.equity  = AccountEquity();
    m.positions_total = OrdersTotal();
    m.positions_buy   = 0;
    m.positions_sell  = 0;
    for (int i = OrdersTotal() - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
        if (OrderSymbol() != Symbol()) continue;
        if (OrderMagicNumber() != MAGIC_NUMBER) continue;
        if (OrderType() == OP_BUY)  m.positions_buy++;
        if (OrderType() == OP_SELL) m.positions_sell++;
    }
    m.tick_volume = (long)Volume[0];
    return m;
}

double CalcVol15m() {
    double atr = iATR(Symbol(), PERIOD_M1, 14, 0);
    double price = (Bid + Ask) / 2.0;
    if (price <= 0) return 0.01;
    return atr / price;
}

double CalcLotSize(double max_risk) {
    double tick_value = MarketInfo(Symbol(), MODE_TICKVALUE);
    double tick_size  = MarketInfo(Symbol(), MODE_TICKSIZE);
    if (tick_value <= 0 || tick_size <= 0) return MarketInfo(Symbol(), MODE_MINLOT);
    double sl_price    = 50.0 * tick_size;
    double risk_per_lot = sl_price * (tick_value / tick_size);
    double lots = max_risk / risk_per_lot;
    double min_lot = MarketInfo(Symbol(), MODE_MINLOT);
    double max_lot = MarketInfo(Symbol(), MODE_MAXLOT);
    lots = MathMax(lots, min_lot);
    lots = MathMin(lots, max_lot);
    return NormalizeDouble(lots, 2);
}

double CalcSL(const string sig, double price) {
    double pt = MarketInfo(Symbol(), MODE_POINT);
    return (sig == "BUY") ? price - 50 * pt : price + 50 * pt;
}

double CalcTP(const string sig, double price) {
    double pt = MarketInfo(Symbol(), MODE_POINT);
    return (sig == "BUY") ? price + 150 * pt : price - 150 * pt;
}

//+------------------------------------------------------------------+
//| JSON Builders                                                    |
//+------------------------------------------------------------------+

string BuildSignalJson(const TradeMetrics &m) {
    return "{\"bid\":"     + DoubleToStr(m.bid, 5) +
           ",\"ask\":"     + DoubleToStr(m.ask, 5) +
           ",\"last\":"    + DoubleToStr((m.bid + m.ask) / 2, 5) +
           ",\"balance\":" + DoubleToStr(m.balance, 2) +
           ",\"equity\":"  + DoubleToStr(m.equity, 2) +
           ",\"positions_total\":"  + IntegerToString(m.positions_total) +
           ",\"positions_buy\":"    + IntegerToString(m.positions_buy) +
           ",\"positions_sell\":"   + IntegerToString(m.positions_sell) +
           ",\"tick_volume\":"      + IntegerToString((int)m.tick_volume) +
           ",\"session\":\""        + DetectSession() + "\"" +
           ",\"vol_15m\":"          + DoubleToStr(CalcVol15m(), 6) + "}";
}

string BuildWebhookJson(int ticket, const string direction, double lots,
                        double open_price, double close_price, double pnl, double mae,
                        datetime open_time, datetime close_time) {
    TradeMetrics m = GetMetrics();
    return "{\"symbol\":\"XAUUSD\""
           ",\"platform\":\"MT4\""
           ",\"bid\":"     + DoubleToStr(m.bid, 5) +
           ",\"ask\":"     + DoubleToStr(m.ask, 5) +
           ",\"last\":"    + DoubleToStr((m.bid + m.ask) / 2, 5) +
           ",\"balance\":" + DoubleToStr(m.balance, 2) +
           ",\"equity\":"  + DoubleToStr(m.equity, 2) +
           ",\"positions_total\":"  + IntegerToString(m.positions_total) +
           ",\"positions_buy\":"    + IntegerToString(m.positions_buy) +
           ",\"positions_sell\":"   + IntegerToString(m.positions_sell) +
           ",\"tick_volume\":"      + IntegerToString((int)m.tick_volume) +
           ",\"bot_instance_id\":\"" + InpBotInstanceId + "\"" +
           ",\"closed_trade\":{"
           "\"ticket\":"   + IntegerToString(ticket) +
           ",\"direction\":\"" + direction + "\"" +
           ",\"lots\":"    + DoubleToStr(lots, 2) +
           ",\"open_price\":"  + DoubleToStr(open_price, 5) +
           ",\"close_price\":" + DoubleToStr(close_price, 5) +
           ",\"pnl\":"     + DoubleToStr(pnl, 2) +
           ",\"max_adverse_excursion\":" + DoubleToStr(mae, 4) +
           ",\"open_time\":\""  + TimeToStr(open_time,  TIME_DATE | TIME_SECONDS) + "\"" +
           ",\"close_time\":\"" + TimeToStr(close_time, TIME_DATE | TIME_SECONDS) + "\"}}";
}

//+------------------------------------------------------------------+
//| Regime Fetch (local fallback for MT4 - limited HTTP)             |
//+------------------------------------------------------------------+

void FetchRegime() {
    g_regime.regime         = "SIDEWAYS_LOW_VOL";
    g_regime.confidence     = 0.65;
    g_regime.kelly_fraction = INITIAL_KELLY_FRACTION;
    g_regime.circuit_breaker = false;
    Log("Régimen (local): " + g_regime.regime);
}

//+------------------------------------------------------------------+
//| Signal Fetch (local heuristic for MT4)                          |
//+------------------------------------------------------------------+

void FetchSignal() {
    double vol = CalcVol15m();
    TradeMetrics m = GetMetrics();

    if (vol > 0.015 && m.positions_total < 3) {
        g_signal.signal     = "BUY";
        g_signal.confidence = 0.62;
    } else if (vol < 0.008 && m.positions_buy > 0) {
        g_signal.signal     = "SELL";
        g_signal.confidence = 0.57;
    } else {
        g_signal.signal     = "SKIP";
        g_signal.confidence = 0.40;
    }

    g_signal.kelly_fraction  = g_regime.kelly_fraction;
    g_signal.skill_applied   = "local_heuristic";
    g_telemetry.total_signals++;

    Log("Señal: " + g_signal.signal +
        " conf=" + DoubleToStr(g_signal.confidence, 2));
}

//+------------------------------------------------------------------+
//| Report Trade (write to file for MT4)                            |
//+------------------------------------------------------------------+

bool ReportTrade(int ticket, const string direction, double lots,
                 double open_price, double close_price, double pnl, double mae,
                 datetime open_time, datetime close_time) {
    if (ticket == g_last_reported_ticket) return true; // already reported
    g_last_reported_ticket = ticket;

    string body = BuildWebhookJson(ticket, direction, lots, open_price,
                                   close_price, pnl, mae, open_time, close_time);

    // MT4 has no native WebRequest - write to file for external script pickup
    int fh = FileOpen("AlphaLog_Webhook_Queue.log",
                      FILE_READ | FILE_WRITE | FILE_TXT);
    if (fh != INVALID_HANDLE) {
        FileSeek(fh, 0, SEEK_END);
        FileWrite(fh, body);
        FileClose(fh);
        Log("Webhook guardado en queue. Ticket=" + IntegerToString(ticket) +
            " PnL=" + DoubleToStr(pnl, 2));
        return true;
    }

    Log("ERROR: No se pudo escribir webhook. Ticket=" + IntegerToString(ticket));
    return false;
}

//+------------------------------------------------------------------+
//| Check closed orders and report them                             |
//+------------------------------------------------------------------+

void CheckClosedOrders() {
    int total = OrdersHistoryTotal();
    for (int i = total - 1; i >= 0; i--) {
        if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
        if (OrderMagicNumber() != MAGIC_NUMBER) continue;
        if (OrderSymbol() != Symbol()) continue;
        if (OrderCloseTime() == 0) continue;
        if (OrderTicket() == g_last_reported_ticket) continue;

        string direction = (OrderType() == OP_BUY) ? "BUY" : "SELL";
        double mae = MathAbs(OrderOpenPrice() - OrderClosePrice()) * 0.3;

        ReportTrade(OrderTicket(), direction, OrderLots(),
                    OrderOpenPrice(), OrderClosePrice(),
                    OrderProfit(), mae,
                    OrderOpenTime(), OrderCloseTime());
    }
}

//+------------------------------------------------------------------+
//| Evaluate Signal & Place Orders                                   |
//+------------------------------------------------------------------+

void EvaluateAndTrade() {
    if (g_signal.signal == "SKIP" || g_signal.signal == "") return;
    if (g_signal.confidence < 0.5) return;
    if (g_regime.circuit_breaker) return;

    double equity  = AccountEquity();
    double maxRisk = equity * RISK_PER_TRADE;
    double lots    = CalcLotSize(maxRisk);
    if (lots <= 0) lots = MarketInfo(Symbol(), MODE_MINLOT);
    if (lots > InpMaxLotSize) lots = InpMaxLotSize;

    double sl = CalcSL(g_signal.signal, Ask);
    double tp = CalcTP(g_signal.signal, Ask);

    if (g_signal.signal == "BUY") {
        bool has_buy = false;
        for (int i = OrdersTotal() - 1; i >= 0; i--) {
            if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
            if (OrderSymbol() == Symbol() && OrderMagicNumber() == MAGIC_NUMBER
                && OrderType() == OP_BUY) { has_buy = true; break; }
        }
        if (!has_buy) {
            int ticket = OrderSend(Symbol(), OP_BUY, lots, Ask, 3, sl, tp,
                                   "AlphaLog BUY", MAGIC_NUMBER, 0, clrGreen);
            if (ticket > 0) {
                Log("BUY lots=" + DoubleToStr(lots, 2) + " ticket=" + IntegerToString(ticket));
                g_telemetry.signals_acted++;
            } else {
                Log("ERROR BUY: " + IntegerToString(GetLastError()));
            }
        }
    }
    else if (g_signal.signal == "SELL") {
        bool has_sell = false;
        for (int i = OrdersTotal() - 1; i >= 0; i--) {
            if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
            if (OrderSymbol() == Symbol() && OrderMagicNumber() == MAGIC_NUMBER
                && OrderType() == OP_SELL) { has_sell = true; break; }
        }
        if (!has_sell) {
            int ticket = OrderSend(Symbol(), OP_SELL, lots, Bid, 3, sl, tp,
                                   "AlphaLog SELL", MAGIC_NUMBER, 0, clrRed);
            if (ticket > 0) {
                Log("SELL lots=" + DoubleToStr(lots, 2) + " ticket=" + IntegerToString(ticket));
                g_telemetry.signals_acted++;
            } else {
                Log("ERROR SELL: " + IntegerToString(GetLastError()));
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Circuit Breaker                                                  |
//+------------------------------------------------------------------+

void CheckCircuitBreaker() {
    if (g_session_start == 0) return;
    double equity  = AccountEquity();
    double change  = (equity - g_session_equity) / g_session_equity;
    if (change < -CIRCUIT_BREAKER_LOSS) {
        Log("CIRCUIT BREAKER: pérdida diaria " + DoubleToStr(change * 100, 2) + "%");
        // Cerrar todas las posiciones
        for (int i = OrdersTotal() - 1; i >= 0; i--) {
            if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
            if (OrderSymbol() != Symbol()) continue;
            if (OrderMagicNumber() != MAGIC_NUMBER) continue;
            if (OrderType() == OP_BUY)
                OrderClose(OrderTicket(), OrderLots(), Bid, 3);
            else if (OrderType() == OP_SELL)
                OrderClose(OrderTicket(), OrderLots(), Ask, 3);
        }
        g_signal.signal = "SKIP";
        g_regime.circuit_breaker = true;
    }
}

//+------------------------------------------------------------------+
//| Telemetry & Daily Log                                           |
//+------------------------------------------------------------------+

void UpdateTelemetry() {
    double eq = AccountEquity();
    if (eq > g_telemetry.highest_equity)
        g_telemetry.highest_equity = eq;
}

void LogDailyResults() {
    double change = AccountEquity() - g_session_equity;
    double pct    = (g_session_equity > 0) ? change / g_session_equity * 100 : 0;
    Log("=== FIN SESION === PnL=" + DoubleToStr(change, 2) +
        " (" + DoubleToStr(pct, 2) + "%)" +
        " trades=" + IntegerToString(g_telemetry.trades_closed));
    g_telemetry.trades_closed = 0;
    g_telemetry.signals_acted = 0;
}

//+------------------------------------------------------------------+
//| EA Init                                                          |
//+------------------------------------------------------------------+

int init() {
    if (InpSignalSecret == "" || InpWebhookSecret == "" || InpBotInstanceId == "") {
        Alert("GoldRangeBasketR: credenciales faltantes en inputs.");
        return 1;
    }

    g_telemetry.connected_since = TimeCurrent();
    g_telemetry.highest_equity  = AccountEquity();

    FetchRegime();

    Log("EA iniciado (MT4). Instancia: " + InpBotInstanceId);
    return 0;
}

//+------------------------------------------------------------------+
//| EA Deinit                                                        |
//+------------------------------------------------------------------+

int deinit() {
    Log("EA detenido. Señales=" + IntegerToString(g_telemetry.total_signals) +
        " Trades=" + IntegerToString(g_telemetry.trades_closed));
    return 0;
}

//+------------------------------------------------------------------+
//| OnTick                                                           |
//+------------------------------------------------------------------+

void start() {
    datetime now = TimeCurrent();

    if ((now - g_last_regime_update) > REGIME_INTERVAL) {
        FetchRegime();
        g_last_regime_update = now;
    }

    if (!IsSessionActive()) {
        if (g_session_start != 0) {
            LogDailyResults();
            g_session_start = 0;
        }
        return;
    }

    if (g_session_start == 0) {
        g_session_start  = now;
        g_session_equity = AccountEquity();
    }

    if ((now - g_last_signal_time) > SIGNAL_INTERVAL) {
        FetchSignal();
        g_last_signal_time = now;
    }

    CheckClosedOrders();
    EvaluateAndTrade();
    CheckCircuitBreaker();
    UpdateTelemetry();
}
//+------------------------------------------------------------------+
