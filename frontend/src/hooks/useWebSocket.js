import { useEffect, useState, useRef, useCallback } from 'react';

export function useWebSocket(url) {
  const [status, setStatus] = useState('OFFLINE');
  const [allSymbols, setAllSymbols] = useState([]);
  
  // Data State
  const [ticks, setTicks] = useState([]);
  const [domBook, setDomBook] = useState([]);
  const [historicalCandles, setHistoricalCandles] = useState([]);
  const [vapSnapshot, setVapSnapshot] = useState([]);
  const [clearEvent, setClearEvent] = useState(0);

  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('WS ONLINE');
      ws.send(JSON.stringify({ action: "LIST_SYMBOLS" }));
    };

    ws.onclose = () => {
      setStatus('OFFLINE');
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "symbols_list") {
        setAllSymbols(msg.data.split(",").filter(s => s.trim().length > 0));
      } else if (msg.type === "tick") {
        setTicks(prev => {
           const newTicks = [...prev, msg];
           // Only keep reasonable amount in state if needed, though VAP and TS use it
           return newTicks.length > 5000 ? newTicks.slice(newTicks.length - 5000) : newTicks;
        });
      } else if (msg.type === "book") {
        setDomBook(msg.data);
      } else if (msg.type === "candles") {
        setHistoricalCandles(msg.data);
      } else if (msg.type === "vap_snapshot") {
        setVapSnapshot(msg.data);
      } else if (msg.type === "status" && msg.clear) {
        setClearEvent(Date.now());
      }
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const connectToAsset = useCallback((asset) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "SUBSCRIBE", param: asset }));
  }, []);

  const disconnectAsset = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "UNSUBSCRIBE" }));
  }, []);

  const requestVAP = useCallback((mins) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "GET_VAP", param: mins }));
  }, []);

  // Expose a clear function to empty state locally
  const clearLocalData = useCallback(() => {
    setTicks([]);
    setDomBook([]);
    setHistoricalCandles([]);
    setVapSnapshot([]);
  }, []);

  return {
    status,
    allSymbols,
    ticks,
    domBook,
    historicalCandles,
    vapSnapshot,
    clearEvent,
    connectToAsset,
    disconnectAsset,
    requestVAP,
    clearLocalData
  };
}
