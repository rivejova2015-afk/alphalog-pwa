//+------------------------------------------------------------------+
//| GoldRangeBasketR EA v1.2                                         |
//| MT5 Expert Advisor - AlphaLog Integration                        |
//| Pairing: 1 token → auto-configura todo (secrets + instance ID)  |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property link      "https://alphalog.io"
#property version   "1.2"

#include <Trade\Trade.mqh>
#include <Trade\SymbolInfo.mqh>

//+------------------------------------------------------------------+
//| Configuration & Constants                                        |
//+------------------------------------------------------------------+

const string API_URL = "https://alphalog.io/api";
const double INITIAL_KELLY_FRACTION = 0.042;
const double RISK_PER_TRADE = 0.02;
const double CIRCUIT_BREAKER_DAILY_LOSS = 0.05;
const int    SIGNAL_REQUEST_INTERVAL = 5;
const int    REGIME_UPDATE_INTERVAL  = 900;
const int    WEBHOOK_TIMEOUT         = 10;
const int    WEBHOOK_RETRY_MAX       = 3;
const int    MAGIC_NUMBER            = 20260422;
const int    LONDON_OPEN             = 8;
const int    LONDON_CLOSE            = 16;
const int    NY_OPEN                 = 13;
const int    NY_CLOSE                = 22;

//+------------------------------------------------------------------+
//| Input Parameters                                                 |
//+------------------------------------------------------------------+

// ── ÚNICO PARÁMETRO REQUERIDO ─────────────────────────────────────
// Genera tu token en AlphaLog → Bot Control → Generar Token de Emparejamiento
// Formato: GOLD-XXXX-XXXX
input string InpPairingToken  = "";     // Token de Emparejamiento (ej: GOLD-A1B2-C3D4)

// ── OPCIONALES ───────────────────────────────────────────────────
input double InpMaxLotSize    = 10.0;   // Tamaño máximo de lote
input bool   InpEnableLogging = true;   // Logging detallado

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
    double max_position_size;
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
//| Global State                                                     |
//+------------------------------------------------------------------+

CTrade       g_trade;
CSymbolInfo  g_sym;
RegimeData   g_regime;
SignalData   g_signal;
TelemetryData g_telemetry;

datetime g_last_regime_update = 0;
datetime g_last_signal_time   = 0;
datetime g_session_start      = 0;
double   g_session_equity     = 0.0;

// Credenciales obtenidas automáticamente vía pairing
string g_signal_secret   = "";
string g_webhook_secret  = "";
string g_bot_instance_id = "";
bool   g_is_paper_mode   = false;
bool   g_paired          = false;

// Archivo local para cachear credenciales entre reinicios
const string CACHE_FILE = "alphalog_credentials.ini";

//+------------------------------------------------------------------+
//| Utility: build uchar array from string                           |
//+------------------------------------------------------------------+

void StringToUchar(const string text, uchar &arr[]) {
    int len = StringLen(text);
    ArrayResize(arr, len);
    for (int i = 0; i < len; i++) {
        arr[i] = (uchar)StringGetCharacter(text, i);
    }
}

//+------------------------------------------------------------------+
//| Utility: HTTP GET                                                |
//+------------------------------------------------------------------+

bool HttpGet(const string url, const string auth_header, string &out) {
    string req_headers = "Authorization: Bearer " + auth_header + "\r\n"
                       + "Content-Type: application/json\r\n";
    uchar  data[];
    uchar  result[];
    string res_headers;

    int status = WebRequest("GET", url, req_headers, WEBHOOK_TIMEOUT * 1000,
                            data, result, res_headers);
    if (status != 200) {
        Log("HTTP GET failed: " + url + " status=" + IntegerToString(status));
        return false;
    }
    out = CharArrayToString(result);
    return true;
}

//+------------------------------------------------------------------+
//| Utility: HTTP POST                                               |
//+------------------------------------------------------------------+

bool HttpPost(const string url, const string headers, const string body,
              int timeout_ms, string &out) {
    uchar data[];
    uchar result[];
    string res_headers;

    StringToUchar(body, data);

    int status = WebRequest("POST", url, headers, timeout_ms,
                            data, result, res_headers);
    if (status != 200) {
        Log("HTTP POST failed: " + url + " status=" + IntegerToString(status));
        return false;
    }
    out = CharArrayToString(result);
    return true;
}

//+------------------------------------------------------------------+
//| Utility: Simple JSON value extraction                            |
//+------------------------------------------------------------------+

string JsonString(const string json, const string key) {
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

double JsonDouble(const string json, const string key) {
    string search = "\"" + key + "\"";
    int idx = StringFind(json, search);
    if (idx < 0) return 0.0;
    int colon = StringFind(json, ":", idx);
    if (colon < 0) return 0.0;
    return StringToDouble(StringSubstr(json, colon + 1, 12));
}

//+------------------------------------------------------------------+
//| Logging                                                          |
//+------------------------------------------------------------------+

void Log(const string msg) {
    if (!InpEnableLogging) return;
    string ts = TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS);
    string line = "[" + ts + "] " + msg;
    Print(line);
    int fh = FileOpen("GoldRangeBasketR.log",
                      FILE_READ | FILE_WRITE | FILE_TXT | FILE_ANSI);
    if (fh != INVALID_HANDLE) {
        FileSeek(fh, 0, SEEK_END);
        FileWriteString(fh, line + "\n");
        FileClose(fh);
    }
}

//+------------------------------------------------------------------+
//| Cache helpers                                                    |
//+------------------------------------------------------------------+

bool LoadCachedCredentials() {
    int fh = FileOpen(CACHE_FILE, FILE_READ | FILE_TXT | FILE_ANSI);
    if (fh == INVALID_HANDLE) return false;
    g_signal_secret   = FileReadString(fh);
    g_webhook_secret  = FileReadString(fh);
    g_bot_instance_id = FileReadString(fh);
    g_is_paper_mode   = (FileReadString(fh) == "true");
    FileClose(fh);
    return g_signal_secret != "" && g_bot_instance_id != "";
}

void SaveCachedCredentials() {
    int fh = FileOpen(CACHE_FILE, FILE_WRITE | FILE_TXT | FILE_ANSI);
    if (fh == INVALID_HANDLE) return;
    FileWriteString(fh, g_signal_secret   + "\n");
    FileWriteString(fh, g_webhook_secret  + "\n");
    FileWriteString(fh, g_bot_instance_id + "\n");
    FileWriteString(fh, (g_is_paper_mode ? "true" : "false") + "\n");
    FileClose(fh);
}

void ClearCachedCredentials() {
    FileDelete(CACHE_FILE);
}

//+------------------------------------------------------------------+
//| Pairing: exchange token for credentials                          |
//+------------------------------------------------------------------+

bool PairWithAlphaLog() {
    long   account_number = AccountInfoInteger(ACCOUNT_LOGIN);
    string broker         = AccountInfoString(ACCOUNT_COMPANY);
    string body = "{\"pairing_token\":\""  + InpPairingToken + "\""
                + ",\"account_number\":"   + IntegerToString((int)account_number)
                + ",\"broker_name\":\""    + broker + "\""
                + ",\"platform\":\"MT5\"}";

    string url     = API_URL + "/bot/pair";
    string headers = "Content-Type: application/json\r\n";
    string response;

    Log("Emparejando con AlphaLog... cuenta=" + IntegerToString((int)account_number) + " broker=" + broker);

    if (!HttpPost(url, headers, body, 15000, response)) {
        Log("ERROR: Pairing falló. Verifica el token y la conexión a internet.");
        return false;
    }

    string ok = JsonString(response, "ok");
    if (ok != "true") {
        string errMsg = JsonString(response, "error");
        Log("ERROR Pairing: " + errMsg);
        Alert("AlphaLog Pairing Error: " + errMsg);
        return false;
    }

    g_signal_secret   = JsonString(response, "signal_secret");
    g_webhook_secret  = JsonString(response, "webhook_secret");
    g_bot_instance_id = JsonString(response, "instance_id");
    g_is_paper_mode   = (JsonString(response, "is_paper_mode") == "true");

    SaveCachedCredentials();

    string msg = JsonString(response, "message");
    Log("Emparejado OK: " + msg);
    Log("Instancia: " + g_bot_instance_id + " | Paper: " + (g_is_paper_mode ? "SI" : "NO"));
    return true;
}

//+------------------------------------------------------------------+
//| EA Init                                                          |
//+------------------------------------------------------------------+

int OnInit() {
    g_trade.SetExpertMagicNumber(MAGIC_NUMBER);
    g_sym.Name(Symbol());
    g_telemetry.connected_since = TimeCurrent();
    g_telemetry.highest_equity  = AccountInfoDouble(ACCOUNT_EQUITY);

    // 1. Intentar cargar credenciales cacheadas (reinicio sin token)
    if (LoadCachedCredentials()) {
        g_paired = true;
        Log("Credenciales cargadas desde caché. Instancia: " + g_bot_instance_id);
    }
    // 2. Si hay token nuevo, emparejar aunque haya caché
    else if (InpPairingToken != "") {
        if (!PairWithAlphaLog()) return INIT_FAILED;
        g_paired = true;
    }
    else {
        Alert("GoldRangeBasketR: Ingresa tu token en 'InpPairingToken'.\n"
              "Genera uno en AlphaLog → Bot Control → Generar Token.");
        return INIT_PARAMETERS_INCORRECT;
    }

    FetchRegime();
    Log("EA listo. Modo: " + (g_is_paper_mode ? "PAPER" : "LIVE"));
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| EA Deinit                                                        |
//+------------------------------------------------------------------+

void OnDeinit(const int reason) {
    Log("EA detenido. Reason=" + IntegerToString(reason));
    CloseAllPositions("EA shutdown");
    Log("Señales recibidas: " + IntegerToString(g_telemetry.total_signals));
    Log("Operaciones actuadas: " + IntegerToString(g_telemetry.signals_acted));
    Log("Trades cerrados: " + IntegerToString(g_telemetry.trades_closed));
}

//+------------------------------------------------------------------+
//| OnTick                                                           |
//+------------------------------------------------------------------+

void OnTick() {
    datetime now = TimeCurrent();

    // Actualizar régimen cada 15 min
    if ((now - g_last_regime_update) > REGIME_UPDATE_INTERVAL) {
        FetchRegime();
        g_last_regime_update = now;
    }

    // Sin sesión activa: no operar
    if (!IsSessionActive()) {
        if (g_session_start != 0) {
            LogDailyResults();
            g_session_start = 0;
        }
        return;
    }

    // Registrar apertura de sesión
    if (g_session_start == 0) {
        g_session_start  = now;
        g_session_equity = AccountInfoDouble(ACCOUNT_EQUITY);
    }

    // Señal cada 5 segundos
    if ((now - g_last_signal_time) > SIGNAL_REQUEST_INTERVAL) {
        FetchSignal();
        g_last_signal_time = now;
    }

    EvaluateAndTrade();
    CheckCircuitBreaker();
    UpdateTelemetry();
}

//+------------------------------------------------------------------+
//| Fetch Regime from AlphaLog                                       |
//+------------------------------------------------------------------+

void FetchRegime() {
    string url = API_URL + "/bot/regime/current";
    string body;

    if (!HttpGet(url, g_signal_secret, body)) {
        g_regime.regime = "SIDEWAYS_LOW_VOL";
        g_regime.confidence = 0.5;
        g_regime.kelly_fraction = INITIAL_KELLY_FRACTION;
        return;
    }

    g_regime.regime          = JsonString(body, "regime");
    g_regime.confidence      = JsonDouble(body, "regime_confidence");
    g_regime.kelly_fraction  = JsonDouble(body, "kelly_fraction");
    g_regime.circuit_breaker = (JsonString(body, "circuit_breaker_triggered") == "true");

    if (g_regime.regime == "")           g_regime.regime = "SIDEWAYS_LOW_VOL";
    if (g_regime.confidence == 0.0)      g_regime.confidence = 0.5;
    if (g_regime.kelly_fraction == 0.0)  g_regime.kelly_fraction = INITIAL_KELLY_FRACTION;

    Log("Régimen: " + g_regime.regime +
        " conf=" + DoubleToString(g_regime.confidence, 2) +
        " kelly=" + DoubleToString(g_regime.kelly_fraction, 4));
}

//+------------------------------------------------------------------+
//| Fetch Real-Time Signal                                           |
//+------------------------------------------------------------------+

void FetchSignal() {
    TradeMetrics m = GetMetrics();
    string body_str = BuildSignalJson(m);
    string url     = API_URL + "/bot/signal";
    string headers = "Authorization: Bearer " + g_signal_secret + "\r\n"
                   + "Content-Type: application/json\r\n";
    string response;

    if (!HttpPost(url, headers, body_str, 2000, response)) {
        return;
    }

    string sig = JsonString(response, "signal");
    if (sig == "") return;

    g_signal.signal           = sig;
    g_signal.confidence       = JsonDouble(response, "confidence");
    g_signal.kelly_fraction   = JsonDouble(response, "kelly_fraction");
    g_signal.max_position_size = JsonDouble(response, "max_position_size");
    g_signal.skill_applied    = JsonString(response, "skill_applied");

    g_telemetry.total_signals++;
    Log("Señal: " + g_signal.signal +
        " conf=" + DoubleToString(g_signal.confidence, 2) +
        " skill=" + g_signal.skill_applied);
}

//+------------------------------------------------------------------+
//| Evaluate Signal & Place Orders                                   |
//+------------------------------------------------------------------+

void EvaluateAndTrade() {
    if (g_signal.signal == "SKIP" || g_signal.signal == "") return;
    if (g_signal.confidence < 0.5) return;
    if (g_regime.circuit_breaker) return;

    double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    double maxRisk = equity * RISK_PER_TRADE;
    double lots    = CalcLotSize(maxRisk);
    if (lots <= 0) lots = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
    if (lots > InpMaxLotSize) lots = InpMaxLotSize;

    double ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    double bid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    double sl  = CalcSL(g_signal.signal, ask);
    double tp  = CalcTP(g_signal.signal, ask);

    if (g_signal.signal == "BUY" && !HasPosition(POSITION_TYPE_BUY)) {
        if (g_trade.Buy(lots, Symbol(), ask, sl, tp, "AlphaLog BUY")) {
            Log("BUY lots=" + DoubleToString(lots, 2));
            g_telemetry.signals_acted++;
        } else {
            Log("ERROR BUY: " + g_trade.ResultComment());
        }
    }
    else if (g_signal.signal == "SELL" && !HasPosition(POSITION_TYPE_SELL)) {
        if (g_trade.Sell(lots, Symbol(), bid, sl, tp, "AlphaLog SELL")) {
            Log("SELL lots=" + DoubleToString(lots, 2));
            g_telemetry.signals_acted++;
        } else {
            Log("ERROR SELL: " + g_trade.ResultComment());
        }
    }
}

//+------------------------------------------------------------------+
//| Trade Closed Handler                                             |
//+------------------------------------------------------------------+

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &,
                        const MqlTradeResult &) {
    if (trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
    if (trans.deal == 0) return;

    if (!HistoryDealSelect(trans.deal)) return;
    if (HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != MAGIC_NUMBER) return;

    ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
    if (entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) return;

    double open_price  = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
    double lots        = HistoryDealGetDouble(trans.deal, DEAL_VOLUME);
    double pnl         = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
    datetime open_time = (datetime)HistoryDealGetInteger(trans.deal, DEAL_TIME);
    datetime close_time = TimeCurrent();

    ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(trans.deal, DEAL_TYPE);
    string direction = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";

    double close_price = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    double mae = MathAbs(open_price - close_price) * 0.3; // simplified

    if (ReportTrade(trans.deal, direction, lots, open_price, close_price,
                    pnl, mae, open_time, close_time)) {
        g_telemetry.trades_closed++;
    }
}

//+------------------------------------------------------------------+
//| Report Trade via Webhook                                         |
//+------------------------------------------------------------------+

bool ReportTrade(ulong ticket, const string direction, double lots,
                 double open_price, double close_price, double pnl, double mae,
                 datetime open_time, datetime close_time) {
    TradeMetrics m = GetMetrics();
    string body_str = BuildWebhookJson(ticket, direction, lots, open_price,
                                       close_price, pnl, mae, open_time, close_time);

    string headers = "x-signature: placeholder\r\n"
                   + "Content-Type: application/json\r\n";
    string url = API_URL + "/webhooks/mt";

    for (int i = 1; i <= WEBHOOK_RETRY_MAX; i++) {
        string response;
        if (HttpPost(url, headers, body_str, WEBHOOK_TIMEOUT * 1000, response)) {
            Log("Webhook OK. Ticket=" + IntegerToString((int)ticket) +
                " PnL=" + DoubleToString(pnl, 2));
            return true;
        }
        int wait = (int)MathPow(2, i);
        if (wait > 30) wait = 30;
        Log("Webhook retry " + IntegerToString(i) + "/" + IntegerToString(WEBHOOK_RETRY_MAX));
        Sleep(wait * 1000);
    }
    Log("ERROR: Webhook falló después de " + IntegerToString(WEBHOOK_RETRY_MAX) + " intentos.");
    return false;
}

//+------------------------------------------------------------------+
//| Circuit Breaker                                                  |
//+------------------------------------------------------------------+

void CheckCircuitBreaker() {
    if (g_session_start == 0) return;
    double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    double change  = (equity - g_session_equity) / g_session_equity;
    if (change < -CIRCUIT_BREAKER_DAILY_LOSS) {
        Log("CIRCUIT BREAKER: pérdida diaria " + DoubleToString(change * 100, 2) + "%");
        CloseAllPositions("Circuit breaker");
        g_signal.signal = "SKIP";
        g_regime.circuit_breaker = true;
    }
}

//+------------------------------------------------------------------+
//| Position Helpers                                                 |
//+------------------------------------------------------------------+

bool HasPosition(ENUM_POSITION_TYPE type) {
    for (int i = PositionsTotal() - 1; i >= 0; i--) {
        if (PositionGetSymbol(i) != Symbol()) continue;
        if (PositionGetInteger(POSITION_MAGIC) != MAGIC_NUMBER) continue;
        if ((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == type) return true;
    }
    return false;
}

void CloseAllPositions(const string reason) {
    for (int i = PositionsTotal() - 1; i >= 0; i--) {
        if (PositionGetSymbol(i) != Symbol()) continue;
        if (PositionGetInteger(POSITION_MAGIC) != MAGIC_NUMBER) continue;
        ulong ticket = PositionGetTicket(i);
        if (PositionSelectByTicket(ticket)) {
            g_trade.PositionClose(ticket);
            Log("Cerrada posición " + IntegerToString((int)ticket) + " - " + reason);
        }
    }
}

//+------------------------------------------------------------------+
//| Calculations                                                     |
//+------------------------------------------------------------------+

double CalcLotSize(double max_risk) {
    double tick_value = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_VALUE);
    double tick_size  = SymbolInfoDouble(Symbol(), SYMBOL_TRADE_TICK_SIZE);
    if (tick_value <= 0 || tick_size <= 0) return SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
    double sl_price    = 50.0 * tick_size;
    double risk_per_lot = sl_price * (tick_value / tick_size);
    double lots = max_risk / risk_per_lot;
    double min_lot = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
    double max_lot = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MAX);
    lots = MathMax(lots, min_lot);
    lots = MathMin(lots, max_lot);
    return NormalizeDouble(lots, 2);
}

double CalcSL(const string sig, double price) {
    double pt = SymbolInfoDouble(Symbol(), SYMBOL_POINT);
    return (sig == "BUY") ? price - 50 * pt : price + 50 * pt;
}

double CalcTP(const string sig, double price) {
    double pt = SymbolInfoDouble(Symbol(), SYMBOL_POINT);
    return (sig == "BUY") ? price + 150 * pt : price - 150 * pt;
}

string DetectSession() {
    MqlDateTime dt;
    TimeToStruct(TimeGMT(), dt);
    int h = dt.hour;
    if (h >= NY_OPEN && h < LONDON_CLOSE) return "OVERLAP";
    if (h >= LONDON_OPEN && h < LONDON_CLOSE) return "LONDON";
    if (h >= NY_OPEN && h < NY_CLOSE) return "NY";
    return "CLOSED";
}

bool IsSessionActive() {
    return DetectSession() != "CLOSED";
}

double CalcVol15m() {
    double atr = iATR(Symbol(), PERIOD_M1, 14);
    double price = (SymbolInfoDouble(Symbol(), SYMBOL_BID) +
                    SymbolInfoDouble(Symbol(), SYMBOL_ASK)) / 2.0;
    if (price <= 0) return 0.01;
    return atr / price;
}

TradeMetrics GetMetrics() {
    TradeMetrics m;
    m.bid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    m.ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    m.balance = AccountInfoDouble(ACCOUNT_BALANCE);
    m.equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    m.positions_total = PositionsTotal();
    m.positions_buy   = 0;
    m.positions_sell  = 0;
    for (int i = PositionsTotal() - 1; i >= 0; i--) {
        if (PositionGetSymbol(i) != Symbol()) continue;
        ENUM_POSITION_TYPE t = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if (t == POSITION_TYPE_BUY)  m.positions_buy++;
        if (t == POSITION_TYPE_SELL) m.positions_sell++;
    }
    m.tick_volume = (long)iVolume(Symbol(), PERIOD_M1, 0);
    return m;
}

void UpdateTelemetry() {
    double eq = AccountInfoDouble(ACCOUNT_EQUITY);
    if (eq > g_telemetry.highest_equity)
        g_telemetry.highest_equity = eq;
}

void LogDailyResults() {
    double change = AccountInfoDouble(ACCOUNT_EQUITY) - g_session_equity;
    double pct    = (g_session_equity > 0) ? change / g_session_equity * 100 : 0;
    Log("=== FIN SESION === PnL=" + DoubleToString(change, 2) +
        " (" + DoubleToString(pct, 2) + "%)" +
        " trades=" + IntegerToString(g_telemetry.trades_closed));
    g_telemetry.trades_closed = 0;
    g_telemetry.signals_acted = 0;
}

//+------------------------------------------------------------------+
//| JSON Builders                                                    |
//+------------------------------------------------------------------+

string BuildSignalJson(const TradeMetrics &m) {
    return "{\"bid\":"     + DoubleToString(m.bid, 5) +
           ",\"ask\":"     + DoubleToString(m.ask, 5) +
           ",\"last\":"    + DoubleToString((m.bid + m.ask) / 2, 5) +
           ",\"balance\":" + DoubleToString(m.balance, 2) +
           ",\"equity\":"  + DoubleToString(m.equity, 2) +
           ",\"positions_total\":"  + IntegerToString(m.positions_total) +
           ",\"positions_buy\":"    + IntegerToString(m.positions_buy) +
           ",\"positions_sell\":"   + IntegerToString(m.positions_sell) +
           ",\"tick_volume\":"      + IntegerToString((int)m.tick_volume) +
           ",\"session\":\""        + DetectSession() + "\"" +
           ",\"vol_15m\":"          + DoubleToString(CalcVol15m(), 6) + "}";
}

string BuildWebhookJson(ulong ticket, const string direction, double lots,
                        double open_price, double close_price, double pnl, double mae,
                        datetime open_time, datetime close_time) {
    TradeMetrics m = GetMetrics();
    return "{\"symbol\":\"XAUUSD\""
           ",\"platform\":\"MT5\""
           ",\"bid\":"     + DoubleToString(m.bid, 5) +
           ",\"ask\":"     + DoubleToString(m.ask, 5) +
           ",\"last\":"    + DoubleToString((m.bid + m.ask) / 2, 5) +
           ",\"balance\":" + DoubleToString(m.balance, 2) +
           ",\"equity\":"  + DoubleToString(m.equity, 2) +
           ",\"positions_total\":"  + IntegerToString(m.positions_total) +
           ",\"positions_buy\":"    + IntegerToString(m.positions_buy) +
           ",\"positions_sell\":"   + IntegerToString(m.positions_sell) +
           ",\"tick_volume\":"      + IntegerToString((int)m.tick_volume) +
           ",\"bot_instance_id\":\"" + g_bot_instance_id + "\"" +
           ",\"closed_trade\":{"
           "\"ticket\":"            + IntegerToString((int)ticket) +
           ",\"direction\":\""      + direction + "\"" +
           ",\"lots\":"             + DoubleToString(lots, 2) +
           ",\"open_price\":"       + DoubleToString(open_price, 5) +
           ",\"close_price\":"      + DoubleToString(close_price, 5) +
           ",\"pnl\":"              + DoubleToString(pnl, 2) +
           ",\"max_adverse_excursion\":" + DoubleToString(mae, 4) +
           ",\"open_time\":\""  + TimeToString(open_time,  TIME_DATE | TIME_SECONDS) + "\"" +
           ",\"close_time\":\"" + TimeToString(close_time, TIME_DATE | TIME_SECONDS) + "\"}}";
}
//+------------------------------------------------------------------+
