import zmq, json, asyncio, re, datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

ctx = zmq.Context()
receiver = ctx.socket(zmq.SUB); receiver.setsockopt(zmq.RCVHWM, 100)
receiver.bind("tcp://127.0.0.1:5555"); receiver.setsockopt_string(zmq.SUBSCRIBE, "")
commander = ctx.socket(zmq.PUB); commander.bind("tcp://127.0.0.1:5556")

connections = set()

def force_mt5_format(date_str):
    """Garante o formato YYYY.MM.DD HH:MM:SS"""
    d = str(date_str).strip().replace("-", ".").replace("/", ".")
    parts = d.split(" ")
    date_part = parts[0]
    time_part = parts[1] if len(parts) > 1 else "00:00:00"
    
    d_bits = date_part.split(".")
    if len(d_bits) == 3 and len(d_bits[0]) == 2: # Se for DD.MM.YYYY
        date_part = f"{d_bits[2]}.{d_bits[1]}.{d_bits[0]}"
    
    return f"{date_part} {time_part}"

async def zmq_to_ws_loop():
    while True:
        try:
            msg = receiver.recv_string(flags=zmq.NOBLOCK)
            if connections:
                await asyncio.gather(*[ws.send_text(msg) for ws in connections])
        except zmq.Again: await asyncio.sleep(0.001)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(zmq_to_ws_loop()); yield; task.cancel()

app = FastAPI(lifespan=lifespan)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept(); connections.add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                js = json.loads(data)
                action = js.get("action", "").upper()
                raw_param = str(js.get("param", ""))
                
                if ";" in raw_param:
                    p_split = raw_param.split(";")
                    inicio = force_mt5_format(p_split[0])
                    fim = force_mt5_format(p_split[1])
                    final_param = f"{inicio};{fim}" # DATA1;DATA2
                else:
                    final_param = force_mt5_format(raw_param)
                
                payload = f"{action}|{final_param}".strip()
                print(f"[DEBUG PYTHON] Payload Final: {payload}")
                commander.send_string(payload)
                
            except Exception as e:
                print(f"Erro: {e}")
                commander.send_string(data.upper())
    except WebSocketDisconnect: connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)