//+------------------------------------------------------------------+
//|                                       historical-bridge.mq5      |
//|         AlphaLog historical data ingestor for MT5                |
//|         Pulls OHLCV from terminal history and uploads to API     |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property version   "1.00"
#property strict
#property script_show_inputs

input string  InpEndpointURL    = "https://alphalog.io/api/historical-bars/ingest";
input string  InpHmacSecret     = "";
input string  InpSymbols        = "XAUUSD,EURUSD";
input string  InpTimeframes     = "M1,M5,H1";
input datetime InpFromDate      = D'2017.01.01 00:00';
input datetime InpToDate        = D'2026.01.01 00:00';
input int     InpBatchSize      = 1000;
input string  InpUserId         = "";

ENUM_TIMEFRAMES TimeframeFromString(const string s) {
   if(s=="M1")  return PERIOD_M1;
   if(s=="M5")  return PERIOD_M5;
   if(s=="M15") return PERIOD_M15;
   if(s=="M30") return PERIOD_M30;
   if(s=="H1")  return PERIOD_H1;
   if(s=="H4")  return PERIOD_H4;
   if(s=="D1")  return PERIOD_D1;
   if(s=="W1")  return PERIOD_W1;
   if(s=="MN1") return PERIOD_MN1;
   return PERIOD_CURRENT;
}

string TimeframeToString(ENUM_TIMEFRAMES tf) {
   switch(tf){
      case PERIOD_M1:  return "M1";
      case PERIOD_M5:  return "M5";
      case PERIOD_M15: return "M15";
      case PERIOD_M30: return "M30";
      case PERIOD_H1:  return "H1";
      case PERIOD_H4:  return "H4";
      case PERIOD_D1:  return "D1";
      case PERIOD_W1:  return "W1";
      case PERIOD_MN1: return "MN1";
   }
   return "M1";
}

void SplitCSV(const string src, string &out[]) {
   ushort sep = StringGetCharacter(",", 0);
   StringSplit(src, sep, out);
   for(int i=0; i<ArraySize(out); i++) out[i] = StringTrimLeft(StringTrimRight(out[i]));
}

string IsoTimestamp(datetime t) {
   MqlDateTime mdt;
   TimeToStruct(t, mdt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      mdt.year, mdt.mon, mdt.day, mdt.hour, mdt.min, mdt.sec);
}

string HmacSha256Hex(const string key, const string msg) {
   uchar k[], m[], hash[];
   StringToCharArray(key, k, 0, StringLen(key));
   StringToCharArray(msg, m, 0, StringLen(msg));
   if(!CryptEncode(CRYPT_HMAC_SHA256, m, k, hash)) return "";
   string hex = "";
   for(int i=0; i<ArraySize(hash); i++) hex += StringFormat("%02x", hash[i]);
   return hex;
}

string BuildBarsJson(MqlRates &rates[], int from, int count) {
   string out = "[";
   for(int i=from; i<from+count; i++) {
      if(i>from) out += ",";
      out += StringFormat(
         "{\"ts\":\"%s\",\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%I64d,\"spread\":%d}",
         IsoTimestamp(rates[i].time),
         rates[i].open, rates[i].high, rates[i].low, rates[i].close,
         rates[i].tick_volume, rates[i].spread);
   }
   out += "]";
   return out;
}

bool PostBatch(const string symbol, const string tfStr, const string barsJson) {
   string body = StringFormat(
      "{\"symbol\":\"%s\",\"timeframe\":\"%s\",\"source\":\"mt5\",\"user_id\":\"%s\",\"bars\":%s}",
      symbol, tfStr, InpUserId, barsJson);
   string sig = HmacSha256Hex(InpHmacSecret, body);
   if(sig=="") { Print("HMAC failure"); return false; }

   char post[];
   StringToCharArray(body, post, 0, StringLen(body), CP_UTF8);
   ArrayResize(post, ArraySize(post)-1);

   string headers = "Content-Type: application/json\r\nX-Signature: " + sig + "\r\n";
   char result[]; string resp_headers;
   int code = WebRequest("POST", InpEndpointURL, headers, 30000, post, result, resp_headers);
   if(code!=200) {
      Print("POST failed code=", code, " body=", CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8));
      return false;
   }
   return true;
}

void OnStart() {
   if(InpHmacSecret=="") { Print("HMAC secret empty"); return; }

   string symbols[]; SplitCSV(InpSymbols, symbols);
   string tfs[];     SplitCSV(InpTimeframes, tfs);

   for(int s=0; s<ArraySize(symbols); s++) {
      string sym = symbols[s];
      if(sym=="") continue;
      if(!SymbolSelect(sym, true)) { Print("Symbol not found: ", sym); continue; }

      for(int t=0; t<ArraySize(tfs); t++) {
         ENUM_TIMEFRAMES tf = TimeframeFromString(tfs[t]);
         if(tf==PERIOD_CURRENT) continue;
         string tfStr = TimeframeToString(tf);

         MqlRates rates[];
         int copied = CopyRates(sym, tf, InpFromDate, InpToDate, rates);
         if(copied<=0) { Print("No bars for ", sym, " ", tfStr); continue; }

         Print("Ingesting ", copied, " bars for ", sym, " ", tfStr);
         int sent=0;
         while(sent<copied) {
            int chunk = MathMin(InpBatchSize, copied-sent);
            string json = BuildBarsJson(rates, sent, chunk);
            if(!PostBatch(sym, tfStr, json)) {
               Print("Aborting ", sym, " ", tfStr);
               break;
            }
            sent += chunk;
            Comment(StringFormat("%s %s: %d/%d (%.1f%%)", sym, tfStr, sent, copied, 100.0*sent/copied));
         }
         Print("Done ", sym, " ", tfStr, ": ", sent, "/", copied);
      }
   }

   Comment("AlphaLog historical bridge: completed.");
}
