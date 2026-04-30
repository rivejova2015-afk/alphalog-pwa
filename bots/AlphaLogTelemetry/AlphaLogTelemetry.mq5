//+------------------------------------------------------------------+
//| AlphaLogTelemetry EA v1.0                                        |
//| MT5 Expert Advisor - Telemetry-only                              |
//| Reports balance/equity/positions to AlphaLog. No trading.        |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property link      "https://alphalog.io"
#property version   "1.0"
#property strict

const string API_URL          = "https://alphalog.io/api";
const string CACHE_FILE       = "alphalog_telemetry.ini";
const int    HTTP_TIMEOUT_MS  = 10000;

// ── INPUTS ────────────────────────────────────────────────────────
input string InpPairingToken     = "";   // Token (GOLD-XXXX-XXXX) — solo en primera ejecución
input int    InpHeartbeatSeconds = 30;   // Intervalo de envío (mínimo 10)
input bool   InpEnableLogging    = true;

// ── STATE ─────────────────────────────────────────────────────────
string g_webhook_secret  = "";
string g_bot_instance_id = "";
bool   g_paired          = false;
int    g_failures        = 0;

//+------------------------------------------------------------------+
void Log(const string msg) {
    if (InpEnableLogging) Print("[AlphaLogTelemetry] ", msg);
}

void StringToUchar(const string text, uchar &arr[]) {
    int len = StringLen(text);
    ArrayResize(arr, len);
    for (int i = 0; i < len; i++) arr[i] = (uchar)StringGetCharacter(text, i);
}

//+------------------------------------------------------------------+
//| HTTP POST                                                        |
//+------------------------------------------------------------------+
bool HttpPost(const string url, const string headers, const string body, string &out) {
    uchar data[];
    uchar result[];
    string res_headers;
    StringToUchar(body, data);
    int status = WebRequest("POST", url, headers, HTTP_TIMEOUT_MS, data, result, res_headers);
    out = CharArrayToString(result);
    if (status != 200) {
        Log("HTTP POST failed url=" + url + " status=" + IntegerToString(status) + " body=" + out);
        return false;
    }
    return true;
}

//+------------------------------------------------------------------+
//| Read/Write credential cache                                      |
//+------------------------------------------------------------------+
bool LoadCredentials() {
    int handle = FileOpen(CACHE_FILE, FILE_READ | FILE_TXT | FILE_ANSI);
    if (handle == INVALID_HANDLE) return false;
    string content = "";
    while (!FileIsEnding(handle)) content += FileReadString(handle) + "\n";
    FileClose(handle);

    int p1 = StringFind(content, "instance_id=");
    int p2 = StringFind(content, "webhook_secret=");
    if (p1 < 0 || p2 < 0) return false;

    int e1 = StringFind(content, "\n", p1);
    int e2 = StringFind(content, "\n", p2);
    g_bot_instance_id = StringSubstr(content, p1 + 12, e1 - p1 - 12);
    g_webhook_secret  = StringSubstr(content, p2 + 15, e2 - p2 - 15);
    StringTrimLeft(g_bot_instance_id); StringTrimRight(g_bot_instance_id);
    StringTrimLeft(g_webhook_secret);  StringTrimRight(g_webhook_secret);
    return StringLen(g_bot_instance_id) > 0 && StringLen(g_webhook_secret) > 0;
}

void SaveCredentials() {
    int handle = FileOpen(CACHE_FILE, FILE_WRITE | FILE_TXT | FILE_ANSI);
    if (handle == INVALID_HANDLE) { Log("WARNING: cannot save credentials"); return; }
    FileWriteString(handle, "instance_id=" + g_bot_instance_id + "\n");
    FileWriteString(handle, "webhook_secret=" + g_webhook_secret + "\n");
    FileClose(handle);
}

//+------------------------------------------------------------------+
//| JSON helpers                                                     |
//+------------------------------------------------------------------+
string JsonField(const string body, const string key) {
    string needle = "\"" + key + "\":";
    int p = StringFind(body, needle);
    if (p < 0) return "";
    p += StringLen(needle);
    while (p < StringLen(body) && StringGetCharacter(body, p) == ' ') p++;
    if (p >= StringLen(body)) return "";
    ushort first = StringGetCharacter(body, p);
    if (first == '"') {
        int e = StringFind(body, "\"", p + 1);
        if (e < 0) return "";
        return StringSubstr(body, p + 1, e - p - 1);
    } else {
        int e = p;
        while (e < StringLen(body)) {
            ushort ch = StringGetCharacter(body, e);
            if (ch == ',' || ch == '}' || ch == ' ' || ch == '\n') break;
            e++;
        }
        return StringSubstr(body, p, e - p);
    }
}

//+------------------------------------------------------------------+
//| Pairing                                                          |
//+------------------------------------------------------------------+
bool DoPairing() {
    if (StringLen(InpPairingToken) < 8) {
        Log("ERROR: InpPairingToken vacío. Pega el token GOLD-XXXX-XXXX desde AlphaLog.");
        return false;
    }
    long account_login = AccountInfoInteger(ACCOUNT_LOGIN);
    string broker      = AccountInfoString(ACCOUNT_COMPANY);

    string body = StringFormat(
        "{\"pairing_token\":\"%s\",\"account_number\":%d,\"broker_name\":\"%s\",\"platform\":\"MT5\"}",
        InpPairingToken, (int)account_login, broker);

    string headers = "Content-Type: application/json\r\n";
    string response;
    if (!HttpPost(API_URL + "/bot/pair", headers, body, response)) {
        Log("Pairing FAILED. Verifica que la URL " + API_URL + " esté en la whitelist (Tools → Options → Expert Advisors).");
        return false;
    }

    string instance_id    = JsonField(response, "instance_id");
    string webhook_secret = JsonField(response, "webhook_secret");
    if (StringLen(instance_id) == 0 || StringLen(webhook_secret) == 0) {
        Log("Pairing response missing fields: " + response);
        return false;
    }

    g_bot_instance_id = instance_id;
    g_webhook_secret  = webhook_secret;
    SaveCredentials();
    Log("Pairing successful. instance_id=" + g_bot_instance_id);
    return true;
}

//+------------------------------------------------------------------+
//| Heartbeat                                                        |
//+------------------------------------------------------------------+
void SendHeartbeat() {
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    int total = PositionsTotal();
    int buys = 0, sells = 0;
    for (int i = 0; i < total; i++) {
        ulong ticket = PositionGetTicket(i);
        if (ticket == 0) continue;
        if (!PositionSelectByTicket(ticket)) continue;
        long ptype = PositionGetInteger(POSITION_TYPE);
        if (ptype == POSITION_TYPE_BUY) buys++;
        else if (ptype == POSITION_TYPE_SELL) sells++;
    }

    string body = StringFormat(
        "{\"bot_instance_id\":\"%s\",\"balance\":%.2f,\"equity\":%.2f,\"positions_total\":%d,\"positions_buy\":%d,\"positions_sell\":%d}",
        g_bot_instance_id, balance, equity, total, buys, sells);

    string headers = "Content-Type: application/json\r\n"
                   + "x-webhook-secret: " + g_webhook_secret + "\r\n";

    string response;
    if (!HttpPost(API_URL + "/webhooks/telemetry", headers, body, response)) {
        g_failures++;
        if (g_failures >= 5) {
            Log("WARNING: 5 heartbeats fallidos. Verifica conexión / token.");
            g_failures = 0;
        }
    } else {
        g_failures = 0;
    }
}

//+------------------------------------------------------------------+
//| OnInit / OnTimer / OnDeinit                                      |
//+------------------------------------------------------------------+
int OnInit() {
    Log("Iniciando AlphaLogTelemetry v1.0");

    if (LoadCredentials()) {
        Log("Credenciales cargadas desde cache.");
        g_paired = true;
    } else {
        if (!DoPairing()) {
            Log("No se pudo emparejar. Asegúrate de pegar el token y permitir Algo Trading.");
            return INIT_FAILED;
        }
        g_paired = true;
    }

    int interval = InpHeartbeatSeconds < 10 ? 10 : InpHeartbeatSeconds;
    if (!EventSetTimer(interval)) {
        Log("ERROR: EventSetTimer falló");
        return INIT_FAILED;
    }
    Log("Timer activo cada " + IntegerToString(interval) + "s");

    SendHeartbeat(); // primer envío inmediato
    return INIT_SUCCEEDED;
}

void OnTimer() {
    if (g_paired) SendHeartbeat();
}

void OnDeinit(const int reason) {
    EventKillTimer();
    Log("Detenido (reason=" + IntegerToString(reason) + ")");
}

void OnTick() {
    // Sin acciones en tick — la telemetría es 100% basada en timer.
}
