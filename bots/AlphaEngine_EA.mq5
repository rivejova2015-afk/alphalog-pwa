//+------------------------------------------------------------------+
//| AlphaEngine EA v0.1                                              |
//| Thin polling EA for the AlphaLog algorithms surface (Phase B).   |
//| No local strategy — just polls /api/algorithms/{id}/signal,      |
//| executes returned action, and reports fills back via webhook.    |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property link      "https://alphalog.io"
#property version   "0.10"
#property strict

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| Configuration                                                    |
//+------------------------------------------------------------------+

const string API_BASE_URL          = "https://alphalog.io/api";
const int    SIGNAL_POLL_SECONDS   = 5;
const int    WEBHOOK_TIMEOUT_MS    = 10000;
const int    MAGIC_NUMBER          = 20260512;

input string InpAlgorithmId   = "";   // UUID de la estrategia (algorithms.id)
input string InpInstanceToken = "";   // Token de autenticacion (Bearer)
input string InpMt5Secret     = "";   // MT5_WEBHOOK_SECRET (reportar fills)
input double InpDefaultLots   = 0.01; // Lotes default si signal no incluye
input bool   InpEnableLogging = true;

//+------------------------------------------------------------------+
//| State                                                            |
//+------------------------------------------------------------------+

CTrade   trade;
datetime g_last_poll_ts = 0;
string   g_last_signal_id = "";

//+------------------------------------------------------------------+
//| Logging                                                          |
//+------------------------------------------------------------------+

void Log(string msg) {
    if (InpEnableLogging) Print("[AlphaEngine] " + msg);
}

//+------------------------------------------------------------------+
//| OnInit                                                           |
//+------------------------------------------------------------------+

int OnInit() {
    if (StringLen(InpAlgorithmId) == 0) {
        Alert("AlphaEngine: InpAlgorithmId vacio");
        return INIT_FAILED;
    }
    if (StringLen(InpInstanceToken) == 0) {
        Alert("AlphaEngine: InpInstanceToken vacio");
        return INIT_FAILED;
    }
    trade.SetExpertMagicNumber(MAGIC_NUMBER);
    Log("Initialized algorithm_id=" + InpAlgorithmId);
    EventSetTimer(SIGNAL_POLL_SECONDS);
    return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
    EventKillTimer();
}

//+------------------------------------------------------------------+
//| HTTP helpers                                                     |
//+------------------------------------------------------------------+

string HttpRequest(string method, string url, string body, string extra_headers) {
    char   post[];
    char   result[];
    string result_headers;
    string headers = "Content-Type: application/json\r\n";
    headers += "Authorization: Bearer " + InpInstanceToken + "\r\n";
    if (StringLen(extra_headers) > 0) headers += extra_headers;

    if (StringLen(body) > 0) StringToCharArray(body, post, 0, StringLen(body));

    int code = WebRequest(method, url, headers, WEBHOOK_TIMEOUT_MS, post, result, result_headers);
    if (code == -1) {
        Log("WebRequest failed code=-1 err=" + IntegerToString(GetLastError()) + " url=" + url);
        return "";
    }
    if (code < 200 || code >= 300) {
        Log("HTTP " + IntegerToString(code) + " " + url);
        return "";
    }
    return CharArrayToString(result);
}

//+------------------------------------------------------------------+
//| Minimal JSON field extractors (avoid adding heavy JSON libs)     |
//+------------------------------------------------------------------+

string ExtractStringField(string json, string key) {
    string needle = "\"" + key + "\"";
    int kpos = StringFind(json, needle);
    if (kpos < 0) return "";
    int colon = StringFind(json, ":", kpos);
    if (colon < 0) return "";
    int q1 = StringFind(json, "\"", colon + 1);
    if (q1 < 0) return "";
    int q2 = StringFind(json, "\"", q1 + 1);
    if (q2 < 0) return "";
    return StringSubstr(json, q1 + 1, q2 - q1 - 1);
}

double ExtractNumberField(string json, string key, double defaultValue) {
    string needle = "\"" + key + "\"";
    int kpos = StringFind(json, needle);
    if (kpos < 0) return defaultValue;
    int colon = StringFind(json, ":", kpos);
    if (colon < 0) return defaultValue;
    int start = colon + 1;
    while (start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\t')) start++;
    int end = start;
    while (end < StringLen(json)) {
        ushort c = StringGetCharacter(json, end);
        if ((c < '0' || c > '9') && c != '.' && c != '-' && c != '+' && c != 'e' && c != 'E') break;
        end++;
    }
    if (end == start) return defaultValue;
    return StringToDouble(StringSubstr(json, start, end - start));
}

//+------------------------------------------------------------------+
//| Signal poll                                                      |
//+------------------------------------------------------------------+

string PollSignal() {
    string url = API_BASE_URL + "/algorithms/" + InpAlgorithmId + "/signal";
    string body = "{\"symbol\":\"" + Symbol() + "\"}";
    return HttpRequest("POST", url, body, "");
}

//+------------------------------------------------------------------+
//| Report fill back to backend                                      |
//+------------------------------------------------------------------+

void ReportFill(string direction, double entry, double exit_, double lots, double pnl) {
    string url = API_BASE_URL + "/webhooks/algo-trade";
    string body = StringFormat(
        "{\"algorithmId\":\"%s\",\"userId\":\"%s\",\"symbol\":\"%s\",\"direction\":\"%s\",\"lots\":%f,\"entryPrice\":%f,\"exitPrice\":%f,\"pnl\":%f}",
        InpAlgorithmId,
        "",
        Symbol(),
        direction,
        lots,
        entry,
        exit_,
        pnl
    );
    char   post[];
    char   result[];
    string result_headers;
    string headers = "Content-Type: application/json\r\n";
    headers += "x-mt5-secret: " + InpMt5Secret + "\r\n";
    StringToCharArray(body, post, 0, StringLen(body));
    WebRequest("POST", url, headers, WEBHOOK_TIMEOUT_MS, post, result, result_headers);
}

//+------------------------------------------------------------------+
//| Execution                                                        |
//+------------------------------------------------------------------+

void ExecuteAction(string action, double lots) {
    if (action == "BUY") {
        double ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
        if (trade.Buy(lots, Symbol(), ask)) {
            Log("BUY " + DoubleToString(lots, 2) + " @ " + DoubleToString(ask, _Digits));
            ReportFill("BUY", ask, 0.0, lots, 0.0);
        } else {
            Log("BUY failed retcode=" + IntegerToString(trade.ResultRetcode()));
        }
    } else if (action == "SELL") {
        double bid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
        if (trade.Sell(lots, Symbol(), bid)) {
            Log("SELL " + DoubleToString(lots, 2) + " @ " + DoubleToString(bid, _Digits));
            ReportFill("SELL", bid, 0.0, lots, 0.0);
        } else {
            Log("SELL failed retcode=" + IntegerToString(trade.ResultRetcode()));
        }
    }
    // HOLD = no-op
}

//+------------------------------------------------------------------+
//| OnTimer — poll + maybe execute                                   |
//+------------------------------------------------------------------+

void OnTimer() {
    string resp = PollSignal();
    if (StringLen(resp) == 0) return;

    string action = ExtractStringField(resp, "action");
    if (action == "") return;
    if (action == "HOLD") return;

    // De-dup: only execute the same signalId once (server may send it for N polls)
    string signalId = ExtractStringField(resp, "signalId");
    if (StringLen(signalId) > 0 && signalId == g_last_signal_id) return;

    double lots = ExtractNumberField(resp, "lots", InpDefaultLots);
    if (lots <= 0) lots = InpDefaultLots;

    ExecuteAction(action, lots);
    g_last_signal_id = signalId;
    g_last_poll_ts = TimeCurrent();
}

//+------------------------------------------------------------------+
//| OnTick — keep terminal alive; logic lives in OnTimer             |
//+------------------------------------------------------------------+

void OnTick() {
    // Intentionally empty — execution is timer-driven.
}
