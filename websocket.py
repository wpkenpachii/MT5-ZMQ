import asyncio
import websockets
import json
import zmq.asyncio
import sys

# Corrige o loop de eventos no Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

class WebSocketBroker:
    def __init__(self):
        self.clients = set()
        self.subscriptions = {} 

    async def connect(self, ws):
        self.clients.add(ws)
        print(f"[Broker] Cliente web ligado. Total: {len(self.clients)}")

    async def disconnect(self, ws):
        self.clients.discard(ws)
        self.subscriptions.pop(ws, None)
        print(f"[Broker] Cliente web desligado.")

    def subscribe(self, ws, symbol):
        self.subscriptions[ws] = symbol
        print(f"[Broker] Subscrição ativa para: {symbol}")

    async def broadcast_global(self, message):
        if self.clients:
            websockets.broadcast(self.clients, message)

    async def route_market_data(self, symbol, message):
        targets = [ws for ws, sub in self.subscriptions.items() if sub == symbol]
        if targets:
            websockets.broadcast(targets, message)

broker = WebSocketBroker()
context = zmq.asyncio.Context()

# PYTHON É O CLIENTE (Conecta nas portas do MT5)
sock_recv = context.socket(zmq.SUB)
sock_recv.connect("tcp://127.0.0.1:5555")
sock_recv.setsockopt_string(zmq.SUBSCRIBE, "") 

sock_cmd = context.socket(zmq.PUB)
sock_cmd.connect("tcp://127.0.0.1:5558")

async def zmq_listener():
    print("[ZMQ] À escuta de dados do MT5 na porta 5555...")
    while True:
        try:
            msg = await sock_recv.recv_string()
            data = json.loads(msg)
            if data.get("type") in ["symbols_list", "status"]:
                await broker.broadcast_global(msg)
            else:
                symbol = data.get("symbol") or data.get("s")
                if symbol: await broker.route_market_data(symbol, msg)
        except Exception as e:
            await asyncio.sleep(0.01)

async def ws_handler(websocket):
    await broker.connect(websocket)
    await asyncio.sleep(0.5)
    try:
        async for message in websocket:
            req = json.loads(message)
            action = req.get("action")
            
            if action == "LIST_SYMBOLS":
                print("[WS] Solicitando LIST_SYMBOLS...")
                sock_cmd.send_string("LIST_SYMBOLS")
                
            elif action == "SUBSCRIBE":
                symbol = req.get("param")
                if symbol:
                    broker.subscribe(websocket, symbol)
                    sock_cmd.send_string(f"SELECT_SYMBOL|{symbol}")
                    await asyncio.sleep(0.2)
                    
                    # PEDINDO 1000 CANDLES DE HISTÓRICO PARA O GRÁFICO
                    sock_cmd.send_string(f"GET_SNAPSHOT|1000")
                    
            elif action == "GET_VAP":
                mins = req.get("param")
                if mins:
                    print(f"[WS] Solicitando Snapshot VAP de {mins} minutos...")
                    sock_cmd.send_string(f"GET_VAP|{mins}")
                    
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        await broker.disconnect(websocket)

async def main():
    print("Servidor Alpha Online na porta 8000...")
    server = await websockets.serve(ws_handler, "127.0.0.1", 8000)
    await asyncio.gather(server.wait_closed(), zmq_listener())

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass