//+------------------------------------------------------------------+
//| Trading Master MT5 Sync EA                                       |
//| Sends positions and recent closed trades to Trading Master.      |
//+------------------------------------------------------------------+
#property strict
#property version "1.01"

input string EndpointUrl = "http://127.0.0.1:3000/api/mt5/sync";
input string SyncToken = "";
input int SyncIntervalMinutes = 60;
input int HistoryLookbackDays = 3650;

struct TradeRecord
{
   string tradeId;
   string symbol;
   string direction;
   double entryPrice;
   double exitPrice;
   double quantity;
   int leverage;
   datetime entryTime;
   datetime exitTime;
   double pnl;
   double fee;
   string status;
};

int OnInit()
{
   Print("Trading Master EA init. endpoint=", EndpointUrl,
         " tokenSet=", (StringLen(SyncToken) > 0 ? "yes" : "no"),
         " intervalMinutes=", SyncIntervalMinutes,
         " lookbackDays=", HistoryLookbackDays);
   EventSetTimer(MathMax(60, SyncIntervalMinutes * 60));
   SyncToDashboard();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SyncToDashboard();
}

void SyncToDashboard()
{
   TradeRecord records[];
   ArrayResize(records, 0);

   CollectClosedTrades(records);
   CollectOpenPositions(records);

   string payload = BuildPayload(records);
   int statusCode = PostJson(payload, ArraySize(records));

   if(statusCode >= 200 && statusCode < 300)
      Print("Trading Master sync completed. records=", ArraySize(records), " status=", statusCode);
   else
      Print("Trading Master sync failed. records=", ArraySize(records), " status=", statusCode, " error=", GetLastError());
}

void CollectOpenPositions(TradeRecord &records[])
{
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      long type = PositionGetInteger(POSITION_TYPE);
      TradeRecord record;
      long positionId = PositionGetInteger(POSITION_IDENTIFIER);
      record.tradeId = "MT5-" + IntegerToString(positionId);
      record.symbol = PositionGetString(POSITION_SYMBOL);
      record.direction = type == POSITION_TYPE_BUY ? "long" : "short";
      record.entryPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      record.exitPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
      record.quantity = PositionGetDouble(POSITION_VOLUME);
      record.leverage = 1;
      record.entryTime = (datetime)PositionGetInteger(POSITION_TIME);
      record.exitTime = 0;
      record.pnl = PositionGetDouble(POSITION_PROFIT);
      record.fee = MathAbs(PositionGetDouble(POSITION_SWAP));
      record.status = "open";

      PushRecord(records, record);
   }
}

void CollectClosedTrades(TradeRecord &records[])
{
   datetime to = TimeCurrent();
   datetime from = to - HistoryLookbackDays * 86400;

   if(!HistorySelect(from, to))
   {
      Print("HistorySelect failed. error=", GetLastError());
      return;
   }

   for(int i = 0; i < HistoryDealsTotal(); i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0)
         continue;

      long dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL)
         continue;

      long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      long positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(positionId <= 0)
         continue;

      int index = FindRecord(records, "MT5-" + IntegerToString(positionId));
      if(index < 0)
      {
         TradeRecord record;
         record.tradeId = "MT5-" + IntegerToString(positionId);
         record.symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
         record.direction = dealType == DEAL_TYPE_BUY ? "long" : "short";
         record.entryPrice = 0;
         record.exitPrice = 0;
         record.quantity = 0;
         record.leverage = 1;
         record.entryTime = 0;
         record.exitTime = 0;
         record.pnl = 0;
         record.fee = 0;
         record.status = "closed";
         PushRecord(records, record);
         index = ArraySize(records) - 1;
      }

      double price = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      double volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);

      if(entryType == DEAL_ENTRY_IN)
      {
         records[index].direction = dealType == DEAL_TYPE_BUY ? "long" : "short";
         records[index].entryPrice = price;
         records[index].quantity += volume;
         if(records[index].entryTime == 0 || dealTime < records[index].entryTime)
            records[index].entryTime = dealTime;
      }
      else if(entryType == DEAL_ENTRY_OUT || entryType == DEAL_ENTRY_OUT_BY)
      {
         records[index].exitPrice = price;
         if(dealTime > records[index].exitTime)
            records[index].exitTime = dealTime;
         records[index].pnl += HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
         records[index].pnl += HistoryDealGetDouble(dealTicket, DEAL_SWAP);
         records[index].fee += MathAbs(HistoryDealGetDouble(dealTicket, DEAL_COMMISSION));
      }
   }

   for(int i = ArraySize(records) - 1; i >= 0; i--)
   {
      if(records[i].status == "closed" && (records[i].entryTime == 0 || records[i].exitTime == 0 || records[i].entryPrice <= 0))
         RemoveRecord(records, i);
   }
}

string BuildPayload(const TradeRecord &records[])
{
   string json = "{";
   json += "\"account\":\"" + JsonEscape(IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))) + "\",";
   json += "\"server\":\"" + JsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   json += "\"syncedAt\":\"" + FormatIso(TimeCurrent()) + "\",";
   json += "\"trades\":[";

   for(int i = 0; i < ArraySize(records); i++)
   {
      if(i > 0)
         json += ",";

      json += "{";
      json += "\"tradeId\":\"" + JsonEscape(records[i].tradeId) + "\",";
      json += "\"symbol\":\"" + JsonEscape(records[i].symbol) + "\",";
      json += "\"direction\":\"" + records[i].direction + "\",";
      json += "\"entryPrice\":" + DoubleToString(records[i].entryPrice, 8) + ",";
      json += "\"exitPrice\":" + (records[i].exitTime > 0 ? DoubleToString(records[i].exitPrice, 8) : "null") + ",";
      json += "\"quantity\":" + DoubleToString(records[i].quantity, 2) + ",";
      json += "\"leverage\":" + IntegerToString(records[i].leverage) + ",";
      json += "\"entryTime\":\"" + FormatIso(records[i].entryTime) + "\",";
      json += "\"exitTime\":" + (records[i].exitTime > 0 ? "\"" + FormatIso(records[i].exitTime) + "\"" : "null") + ",";
      json += "\"pnl\":" + DoubleToString(records[i].pnl, 2) + ",";
      json += "\"fee\":" + DoubleToString(records[i].fee, 2) + ",";
      json += "\"status\":\"" + records[i].status + "\",";
      json += "\"notes\":\"Synced from MT5 observer account\"";
      json += "}";
   }

   json += "]}";
   return json;
}

int PostJson(const string payload, const int recordCount)
{
   char data[];
   char result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\n";
   headers += "X-MT5-Sync-Token: " + SyncToken + "\r\n";

   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(data) > 0)
      ArrayResize(data, ArraySize(data) - 1);

   Print("Trading Master request. endpoint=", EndpointUrl,
         " tokenSet=", (StringLen(SyncToken) > 0 ? "yes" : "no"),
         " records=", recordCount,
         " bytes=", ArraySize(data));

   ResetLastError();
   int statusCode = WebRequest("POST", EndpointUrl, headers, 15000, data, result, resultHeaders);
   int errorCode = GetLastError();
   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

   Print("Trading Master status=", statusCode, " error=", errorCode);
   Print("Trading Master response headers: ", resultHeaders);
   Print("Trading Master response body: ", response);
   return statusCode;
}

void PushRecord(TradeRecord &records[], const TradeRecord &record)
{
   int size = ArraySize(records);
   ArrayResize(records, size + 1);
   records[size] = record;
}

void RemoveRecord(TradeRecord &records[], const int index)
{
   int size = ArraySize(records);
   for(int i = index; i < size - 1; i++)
      records[i] = records[i + 1];
   ArrayResize(records, size - 1);
}

int FindRecord(const TradeRecord &records[], const string tradeId)
{
   for(int i = 0; i < ArraySize(records); i++)
   {
      if(records[i].tradeId == tradeId)
         return i;
   }
   return -1;
}

string FormatIso(const datetime value)
{
   MqlDateTime dt;
   TimeToStruct(value, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ", dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   return value;
}
