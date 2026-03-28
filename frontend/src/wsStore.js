class WebSocketManager {
  constructor() {
    this.ws = null;
    this.listeners = {
      tick: [],
      book: [],
      candles: [],
      vap_snapshot: [],
      symbols_list: [],
      status_clear: [],
      connection_status: [],
      inactivity: []
    };
    this.status = "OFFLINE";
    this.inactivityTimer = null;
    this.inactivityTimeoutMs = 4000;
  }

  resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    this.inactivityTimer = setTimeout(() => {
      this.emit('inactivity');
    }, this.inactivityTimeoutMs);
  }

  clearInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  connect(url) {
    if (this.ws) {
      this.ws.close();
    }
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.setStatus('WS ONLINE');
      this.ws.send(JSON.stringify({ action: "LIST_SYMBOLS" }));
    };

    this.ws.onclose = () => {
      this.setStatus('OFFLINE');
      this.clearInactivityTimer();
    };

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "symbols_list") {
        const symbols = msg.data.split(",").filter(s => s.trim().length > 0);
        this.emit('symbols_list', symbols);
      } else if (msg.type === "tick") {
        this.resetInactivityTimer();
        this.emit('tick', msg);
      } else if (msg.type === "book") {
        this.resetInactivityTimer();
        this.emit('book', msg.data);
      } else if (msg.type === "candles") {
        this.emit('candles', msg.data);
      } else if (msg.type === "vap_snapshot") {
        this.emit('vap_snapshot', msg.data);
      } else if (msg.type === "status" && msg.clear) {
        this.emit('status_clear');
      }
    };
  }

  setStatus(st) {
    this.status = st;
    this.emit('connection_status', st);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  on(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event].push(cb);
  }

  off(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== cb);
  }

  subscribeAsset(asset) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "SUBSCRIBE", param: asset }));
      this.resetInactivityTimer();
    }
  }

  unsubscribeAsset() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "UNSUBSCRIBE" }));
      this.clearInactivityTimer();
    }
  }

  requestVAP(mins) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "GET_VAP", param: mins }));
    }
  }
}

export const wsManager = new WebSocketManager();
