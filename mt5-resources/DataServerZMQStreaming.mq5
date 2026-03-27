#property copyright "Copyright 2026, sirzarakikenpachi"
#property version   "9.7"
#property strict

#include <ZmqLib.mqh>

input string PubAddr = "tcp://127.0.0.1:5555";
input string SubAddr = "tcp://127.0.0.1:5558";
input int    DefaultDepth = 20;

CZmqManager zmq;
string active_symbol = "";
long last_tick_ms = 0;

int OnInit() {
    active_symbol = _Symbol;
    if(!zmq.Bind(PubAddr, SubAddr)) return(INIT_FAILED);
    
    EventSetMillisecondTimer(1);
    MarketBookAdd(active_symbol);
    Print("[STREAMING 9.7] MT5 Servidor Online com Envio de Trades Neutros!");
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
    EventKillTimer();
    MarketBookRelease(active_symbol);
}

void OnBookEvent(const string &symbol) {
    if(symbol != active_symbol) return;
    
    MqlBookInfo book[];
    if(MarketBookGet(symbol, book)) {
        int total = ArraySize(book);
        if(total > 0) {
            string json = "{\"type\":\"book\",\"symbol\":\""+symbol+"\",\"data\":[";
            int limit = MathMin(total, DefaultDepth * 2);
            for(int i=0; i<limit; i++) {
                string side = (book[i].type == BOOK_TYPE_SELL || book[i].type == BOOK_TYPE_SELL_MARKET) ? "S" : "B";
                json += StringFormat("{\"p\":%.2f,\"v\":%lld,\"t\":\"%s\"}%s", 
                    book[i].price, book[i].volume, side, (i < limit-1 ? "," : ""));
            }
            json += "]}";
            zmq.Send(json);
        }
    }
    
    MqlTick t;
    if(SymbolInfoTick(active_symbol, t)) {
        // CORREÇÃO: Verifica se o tick é um negócio real (alterou o last, volume, ou teve agressão)
        bool is_deal = (t.flags & TICK_FLAG_BUY) || (t.flags & TICK_FLAG_SELL) || (t.flags & TICK_FLAG_LAST) || (t.flags & TICK_FLAG_VOLUME);
        
        if(t.time_msc > last_tick_ms && is_deal && t.volume > 0) {
            last_tick_ms = t.time_msc;
            bool is_buy = ((t.flags & TICK_FLAG_BUY) == TICK_FLAG_BUY);
            bool is_sell = ((t.flags & TICK_FLAG_SELL) == TICK_FLAG_SELL);
            
            string side = "N"; // Neutro (Direto ou Leilão)
            if(is_buy) side = "B";
            else if(is_sell) side = "S";
            
            zmq.Send(StringFormat("{\"type\":\"tick\",\"s\":\"%s\",\"p\":%.2f,\"v\":%lld,\"side\":\"%s\",\"ms\":%lld}", 
                                   active_symbol, t.last, t.volume, side, t.time_msc));
        }
    }
}

void OnTimer() {
    while(true) {
        string msg = zmq.Read();
        if(msg == "") break;
        
        string parts[];
        int n = StringSplit(msg, '|', parts);
        if(n <= 0) continue;
        
        string cmd = parts[0];
        string arg = (n > 1) ? parts[1] : "";

        if(cmd == "LIST_SYMBOLS") {
            string list = "";
            int total_sym = SymbolsTotal(true);
            for(int i=0; i<total_sym; i++) list += SymbolName(i, true) + (i < total_sym-1 ? "," : "");
            zmq.Send("{\"type\":\"symbols_list\",\"data\":\"" + list + "\"}");
        }
        else if(cmd == "SELECT_SYMBOL") {
            if(arg != "" && arg != active_symbol) {
                MarketBookRelease(active_symbol);
                active_symbol = arg;
                last_tick_ms = 0;
                MarketBookAdd(active_symbol);
                zmq.Send("{\"type\":\"status\",\"msg\":\"Ativo alterado para: "+active_symbol+"\"}");
            }
        }
        else if(cmd == "GET_SNAPSHOT") {
            MqlRates rates[];
            int req_count = (arg == "" ? 50 : (int)StringToInteger(arg));
            int copied = CopyRates(active_symbol, _Period, 0, req_count, rates);
            if(copied > 0) {
                string json = "{\"type\":\"candles\",\"symbol\":\""+active_symbol+"\",\"data\":[";
                for(int i=0; i<copied; i++) {
                    json += StringFormat("{\"t\":%lld,\"o\":%.2f,\"h\":%.2f,\"l\":%.2f,\"c\":%.2f,\"v\":%lld}%s", 
                        rates[i].time, rates[i].open, rates[i].high, rates[i].low, rates[i].close, rates[i].tick_volume, (i<copied-1?",":""));
                }
                json += "]}";
                zmq.Send(json);
            }
        }
        else if(cmd == "GET_VAP") {
            int mins = (arg == "" ? 5 : (int)StringToInteger(arg));
            MqlTick ticks[];
            
            ulong to_ms = (ulong)SymbolInfoInteger(active_symbol, SYMBOL_TIME_MSC);
            ulong from_ms = to_ms - (mins * 60000); 
            
            int copied = CopyTicksRange(active_symbol, ticks, COPY_TICKS_TRADE, from_ms);
            if(copied > 0) {
                int start_idx = 0;
                if(copied > 30000) start_idx = copied - 30000; 

                string json;
                StringInit(json, 2000000); 
                json = "{\"type\":\"vap_snapshot\",\"symbol\":\""+active_symbol+"\",\"data\":[";
                bool first = true;
                
                for(int i=start_idx; i<copied; i++) {
                    // CORREÇÃO: Como já usamos COPY_TICKS_TRADE, todos os ticks aqui são negócios. 
                    // Só precisamos de ignorar os que vêm com volume zero (anomalias do servidor).
                    if(ticks[i].volume <= 0) continue; 
                    
                    bool is_buy = ((ticks[i].flags & TICK_FLAG_BUY) == TICK_FLAG_BUY);
                    bool is_sell = ((ticks[i].flags & TICK_FLAG_SELL) == TICK_FLAG_SELL);
                    
                    string side = "N"; // Neutro
                    if(is_buy) side = "B";
                    else if(is_sell) side = "S";
                    
                    if(!first) json += ",";
                    json += StringFormat("{\"p\":%.2f,\"v\":%lld,\"side\":\"%s\",\"ms\":%lld}", 
                        ticks[i].last, ticks[i].volume, side, ticks[i].time_msc);
                    first = false;
                }
                json += "]}";
                zmq.Send(json);
            }
        }
    }
}