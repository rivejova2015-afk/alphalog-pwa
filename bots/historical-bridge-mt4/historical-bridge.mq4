//+------------------------------------------------------------------+
//|                                       historical-bridge.mq4      |
//|         AlphaLog historical data ingestor for MT4                |
//|         Pulls OHLCV from terminal history and uploads to API     |
//+------------------------------------------------------------------+
#property copyright "AlphaLog"
#property version   "1.00"
#property strict
#property show_inputs

extern string EndpointURL    = "https://alphalog.io/api/historical-bars/ingest";
extern string HmacSecret     = "";
extern string Symbols        = "XAUUSD,EURUSD";
extern string Timeframes     = "M1,M5,H1";
extern datetime FromDate     = D'2017.01.01 00:00';
extern datetime ToDate       = D'2026.01.01 00:00';
extern int    BatchSize      = 1000;
extern string UserId         = "";

int TimeframeFromString(string s) {
   if(s=="M1")  return PERIOD_M1;
   if(s=="M5")  return PERIOD_M5;
   if(s=="M15") return PERIOD_M15;
   if(s=="M30") return PERIOD_M30;
   if(s=="H1")  return PERIOD_H1;
   if(s=="H4")  return PERIOD_H4;
   if(s=="D1")  return PERIOD_D1;
   if(s=="W1")  return PERIOD_W1;
   if(s=="MN1") return PERIOD_MN1;
   return 0;
}

string TfToString(int tf) {
   if(tf==PERIOD_M1)  return "M1";
   if(tf==PERIOD_M5)  return "M5";
   if(tf==PERIOD_M15) return "M15";
   if(tf==PERIOD_M30) return "M30";
   if(tf==PERIOD_H1)  return "H1";
   if(tf==PERIOD_H4)  return "H4";
   if(tf==PERIOD_D1)  return "D1";
   if(tf==PERIOD_W1)  return "W1";
   if(tf==PERIOD_MN1) return "MN1";
   return "M1";
}

void SplitCSV(string src, string &arr[]) {
   int n = StringSplit(src, ',', arr);
   for(int i=0; i<n; i++) arr[i] = StringTrimLeft(StringTrimRight(arr[i]));
}

string IsoTs(datetime t) {
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      TimeYear(t), TimeMonth(t), TimeDay(t),
      TimeHour(t), TimeMinute(t), TimeSeconds(t));
}

string HmacHex(string key, string msg) {
   uchar k[], m[], hash[];
   StringToCharArray(key, k, 0, StringLen(key));
   StringToCharArray(msg, m, 0, StringLen(msg));
   if(!CryptEncode(CRYPT_HMAC_SHA256, m, k, hash)) return "";
   string hex = "";
   for(int i=0; i<ArraySize(hash); i++) hex += StringFormat("%02x", hash[i]);
   return hex;
}

bool PostBatch(string sym, string tfStr, string barsJson) {
   string body = StringConcatenate(
      "{\"symbol\":\"", sym, "\",\"timeframe\":\"", tfStr,
      "\",\"source\":\"mt4\",\"user_id\":\"", UserId, "\",\"bars\":", barsJson, "}");
   string sig = HmacHex(HmacSecret, body);
   if(sig=="") { Print("HMAC failure"); return false; }

   char post[]; StringToCharArray(body, post, 0, StringLen(body), CP_UTF8);
   ArrayResize(post, ArraySize(post)-1);
   string headers = "Content-Type: application/json\r\nX-Signature: " + sig + "\r\n";
   char result[]; string resp_headers;
   int code = WebRequest("POST", EndpointURL, headers, 30000, post, result, resp_headers);
   if(code!=200) {
      Print("POST failed code=", code, " body=", CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8));
      return false;
   }
   return true;
}

int OnInit() {
   if(HmacSecret=="") { Print("HMAC secret empty"); return INIT_FAILED; }

   string symArr[];   SplitCSV(Symbols, symArr);
   string tfArr[];    SplitCSV(Timeframes, tfArr);

   for(int s=0; s<ArraySize(symArr); s++) {
      string sym = symArr[s];
      if(sym=="") continue;

      for(int t=0; t<ArraySize(tfArr); t++) {
         int tf = TimeframeFromString(tfArr[t]);
         if(tf==0) continue;
         string tfStr = TfToString(tf);

         int total = iBars(sym, tf);
         if(total<=0) { Print("No bars for ", sym, " ", tfStr); continue; }

         int rangeStart=-1, rangeEnd=-1;
         for(int i=total-1; i>=0; i--) {
            datetime ts = iTime(sym, tf, i);
            if(ts<FromDate) continue;
            if(ts>=ToDate)  break;
            if(rangeStart<0) rangeStart=i;
            rangeEnd=i;
         }
         if(rangeStart<0) { Print("No bars in range ", sym, " ", tfStr); continue; }

         int count = rangeStart - rangeEnd + 1;
         Print("Ingesting ", count, " bars for ", sym, " ", tfStr);

         int sent=0;
         int idx = rangeStart;
         while(sent<count) {
            int chunk = MathMin(BatchSize, count-sent);
            string json = "[";
            for(int k=0; k<chunk; k++, idx--) {
               if(k>0) json += ",";
               datetime ts = iTime(sym, tf, idx);
               json += StringFormat(
                  "{\"ts\":\"%s\",\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%.0f,\"spread\":0}",
                  IsoTs(ts),
                  iOpen(sym, tf, idx), iHigh(sym, tf, idx),
                  iLow(sym, tf, idx),  iClose(sym, tf, idx),
                  iVolume(sym, tf, idx));
            }
            json += "]";
            if(!PostBatch(sym, tfStr, json)) { Print("Aborting"); break; }
            sent += chunk;
            Comment(StringFormat("%s %s: %d/%d (%.1f%%)", sym, tfStr, sent, count, 100.0*sent/count));
         }
         Print("Done ", sym, " ", tfStr, ": ", sent, "/", count);
      }
   }

   Comment("AlphaLog historical bridge: completed.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {}
void OnTick() {}
