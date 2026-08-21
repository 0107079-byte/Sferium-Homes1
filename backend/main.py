import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db import init_db
from backend.redis_client import redis_client
from backend.auth import router as auth_router
from backend.rooms import list_active_rooms, get_room_state, save_room_state
from backend.ws import handle_websocket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sferium.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Sferium Homes Sync backend...")
    await init_db()
    await redis_client.connect()
    yield
    logger.info("Shutting down Sferium Homes Sync backend...")

app = FastAPI(title="Sferium-Homes Sync API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "Sferium-Homes Sync"}

@app.get("/api/rooms")
async def get_rooms():
    return await list_active_rooms()

@app.get("/api/rooms/{room_id}")
async def get_room(room_id: str):
    room = await get_room_state(room_id.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

@app.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    await handle_websocket(websocket, room_id, user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
