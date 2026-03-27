#property copyright "Copyright 2026, wpkenpachii"
#property link      "https://github.com/wpkenpachii"
#property version   "4.0"
#property strict

#include <ZmqLib.mqh>

input string PubAddr = "tcp://127.0.0.1:5555";
input string SubAddr = "tcp://127.0.0.1:5556";
input int    ChunkSize = 100;

CZmqManager zmq;
int current_depth = 5;

//+------------------------------------------------------------------+
int OnInit() {
    if(!zmq.Init(PubAddr, SubAddr)) return(INIT_FAILED);
    EventSetTimer(1);
    MarketBookAdd(_Symbol);
    Print("[STREAMING] Servidor Alpha Full Ticks Online!");
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    EventKillTimer();
    MarketBookRelease(_Symbol);
}

//+------------------------------------------------------------------+
void OnTimer() {
    string msg = zmq.Read();
    if(msg == "") return;

    // Envia confirmação de recebimento
    string ack = "{\"type\":\"ack\",\"status\":\"processing\",\"msg\":\"" + msg + "\"}";
    zmq.Send(ack);

    string parts[];
    int n = StringSplit(msg, '|', parts);
    if(n < 1) return;

    string cmd = parts[0];
    string arg = (n > 1) ? parts[1] : "";

    // 1. LISTAGEM DE ATIVOS
    if(cmd == "LIST_SYMBOLS") {
        string list = "";
        int total = SymbolsTotal(true);
        for(int i=0; i<total; i++) {
            list += SymbolName(i, true) + (i < total-1 ? "," : "");
        }
        zmq.Send("{\"type\":\"symbols_list\",\"data\":\"" + list + "\"}");
    }
    
    // 2. SELEÇÃO DE ATIVO COM LIMPEZA E FALLBACK
    else if(cmd == "SELECT_SYMBOL") {
        string clean_symbol = arg;
        int space_pos = StringFind(clean_symbol, " ");
        if(space_pos > 0) clean_symbol = StringSubstr(clean_symbol, 0, space_pos);
        StringTrimLeft(clean_symbol); 
        StringTrimRight(clean_symbol);

        if(clean_symbol != "" && clean_symbol != _Symbol) {
            MarketBookRelease(_Symbol); 
            if(MarketBookAdd(clean_symbol)) {
                Print("[ZMQ] DOM Conectado: ", clean_symbol);
                zmq.Send("{\"type\":\"config\",\"status\":\"connected\",\"symbol\":\"" + clean_symbol + "\"}");
            } 
            else {
                Print("[ZMQ] DOM Indisponível. Fallback Snapshot: ", clean_symbol);
                zmq.Send("{\"type\":\"warning\",\"msg\":\"DOM indisponivel. Enviando Snapshot fallback.\"}");
                StreamSnapshot((string)current_depth); 
            }
        }
    }

    // 3. COMANDOS DE HISTÓRICO
    else if(cmd == "GET_SNAPSHOT") {
        StreamSnapshot(arg);
    }
    else if(cmd == "GET_TRADES") {
        StreamTrades(arg);
    }
    else if(cmd == "SET_DEPTH") {
        current_depth = (int)StringToInteger(arg);
        string config = "{\"type\":\"config\",\"depth\":" + (string)current_depth + "}";
        zmq.Send(config);
    }
}

//+------------------------------------------------------------------+
void StreamTrades(string arg) {
    MqlTick ticks[];
    ArrayFree(ticks); 
    datetime dt_start = 0, dt_end = 0;
    int total = 0;
    int sep_pos = StringFind(arg, "#"); 

    if(sep_pos > 0) { 
        string s_start = StringSubstr(arg, 0, sep_pos);
        string s_end   = StringSubstr(arg, sep_pos + 1);
        StringTrimLeft(s_start); StringTrimRight(s_start);
        StringTrimLeft(s_end);   StringTrimRight(s_end);
        dt_start = StringToTime(s_start);
        dt_end   = StringToTime(s_end);
        total = CopyTicksRange(_Symbol, ticks, COPY_TICKS_TRADE, (long)dt_start * 1000, (long)dt_end * 1000);
    } 
    else if(StringFind(arg, ".") > 0) { 
        dt_start = StringToTime(arg);
        total = CopyTicksRange(_Symbol, ticks, COPY_TICKS_TRADE, (long)dt_start * 1000);
    } 
    else { 
        int qty = (arg == "" ? 50 : (int)StringToInteger(arg));
        total = CopyTicks(_Symbol, ticks, COPY_TICKS_TRADE, 0, qty);
    }

    if(total <= 0) return;

    int totalChunks = (int)MathCeil((double)total / ChunkSize);
    for(int c = 0; c < totalChunks; c++) {
        int start_idx = c * ChunkSize;
        int end_idx = MathMin(start_idx + ChunkSize, total);
        string json = StringFormat("{\"type\":\"trades_stream\",\"chunk\":%d,\"total\":%d,\"data\":[", c+1, totalChunks);
        for(int i = start_idx; i < end_idx; i++) {
            string side = "T";
            if((ticks[i].flags & TICK_FLAG_BUY) == TICK_FLAG_BUY) side = "B";
            else if((ticks[i].flags & TICK_FLAG_SELL) == TICK_FLAG_SELL) side = "S";
            json += StringFormat("{\"t\":%lld,\"ms\":%lld,\"p\":%.2f,\"v\":%lld,\"side\":\"%s\"}%s",
                ticks[i].time, ticks[i].time_msc, ticks[i].last, ticks[i].volume, side,
                (i < end_idx-1 ? "," : ""));
        }
        zmq.Send(json + "]}");
    }
}

//+------------------------------------------------------------------+
void StreamSnapshot(string arg) {
    MqlRates rates[];
    ArrayFree(rates);
    int total = 0;
    int sep_pos = StringFind(arg, "#");
    
    if(sep_pos > 0) {
        string s_start = StringSubstr(arg, 0, sep_pos);
        string s_end   = StringSubstr(arg, sep_pos + 1);
        StringTrimLeft(s_start); StringTrimRight(s_start);
        StringTrimLeft(s_end);   StringTrimRight(s_end);
        total = CopyRates(_Symbol, _Period, StringToTime(s_start), StringToTime(s_end), rates);
    }
    else if(StringFind(arg, ".") > 0) 
        total = CopyRates(_Symbol, _Period, StringToTime(arg), TimeCurrent(), rates);
    else 
        total = CopyRates(_Symbol, _Period, 0, (arg==""?1:(int)StringToInteger(arg)), rates);

    if(total <= 0) return;

    int totalChunks = (int)MathCeil((double)total / ChunkSize);
    for(int c = 0; c < totalChunks; c++) {
        int start = c * ChunkSize;
        int end = MathMin(start + ChunkSize, total);
        string json = StringFormat("{\"type\":\"snapshot_stream\",\"chunk\":%d,\"total\":%d,\"data\":[", c+1, totalChunks);
        for(int i = start; i < end; i++) {
            json += StringFormat("{\"t\":%lld,\"o\":%.2f,\"h\":%.2f,\"l\":%.2f,\"c\":%.2f,\"v\":%lld}%s",
                rates[i].time, rates[i].open, rates[i].high, rates[i].low, rates[i].close, rates[i].tick_volume,
                (i < end-1 ? "," : ""));
        }
        zmq.Send(json + "]}");
    }
}

//+------------------------------------------------------------------+
void OnTick() {
    MqlTick t;
    if(SymbolInfoTick(_Symbol, t)) {
        string side = "T";
        if((t.flags & TICK_FLAG_BUY) == TICK_FLAG_BUY) side = "B";
        else if((t.flags & TICK_FLAG_SELL) == TICK_FLAG_SELL) side = "S";
        zmq.Send(StringFormat("{\"type\":\"tick\",\"p\":%.2f,\"v\":%lld,\"side\":\"%s\",\"ms\":%lld}", 
                               t.last, t.volume, side, t.time_msc));
    }
}