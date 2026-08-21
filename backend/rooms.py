import json
import time
import secrets
import logging
from sqlalchemy import select
from backend.redis_client import redis_client
from backend.db import async_session_maker, is_db_connected

logger = logging.getLogger("sferium.rooms")
ROOM_KEY_PREFIX = "sferium:room:"

# In-Memory dictionary fallback if PostgreSQL and Redis are unavailable
in_memory_rooms: dict[str, dict] = {}

def generate_invite_code(room_id: str) -> str:
    """Generate unique invitation code for a room."""
    return f"{room_id}-{secrets.token_hex(4)}"

async def get_room_state(room_id: str) -> dict | None:
    """Retrieve room state from Redis cache, PostgreSQL database, or In-Memory fallback."""
    clean_id = room_id.upper()
    key = f"{ROOM_KEY_PREFIX}{clean_id}"
    
    # 1. Try Redis cache
    data = await redis_client.get(key)
    if data:
        try:
            room = json.loads(data)
            in_memory_rooms[clean_id] = room
            return room
        except Exception:
            pass

    # 2. Try PostgreSQL
    if is_db_connected and async_session_maker:
        try:
            async with async_session_maker() as db:
                from backend.models import RoomModel
                stmt = select(RoomModel).where(RoomModel.id == clean_id)
                res = await db.execute(stmt)
                db_room = res.scalar_one_or_none()
                if db_room and db_room.state:
                    state = db_room.state
                    await redis_client.set(key, json.dumps(state))
                    in_memory_rooms[clean_id] = state
                    return state
        except Exception as e:
            logger.warning(f"PostgreSQL fetch room failed ({e}). Falling back to in-memory cache.")

    # 3. Fallback to In-Memory
    return in_memory_rooms.get(clean_id)

async def save_room_state(room_id: str, state: dict):
    """Save room state across In-Memory, Redis cache, and PostgreSQL database."""
    clean_id = room_id.upper()
    key = f"{ROOM_KEY_PREFIX}{clean_id}"
    json_str = json.dumps(state)

    in_memory_rooms[clean_id] = state
    await redis_client.set(key, json_str)

    if is_db_connected and async_session_maker:
        try:
            async with async_session_maker() as db:
                from backend.models import RoomModel
                stmt = select(RoomModel).where(RoomModel.id == clean_id)
                res = await db.execute(stmt)
                db_room = res.scalar_one_or_none()
                
                if db_room:
                    db_room.state = state
                    db_room.updated_at = int(time.time() * 1000)
                else:
                    db_room = RoomModel(
                        id=clean_id,
                        state=state,
                        updated_at=int(time.time() * 1000)
                    )
                    db.add(db_room)
                await db.commit()
        except Exception as e:
            logger.warning(f"Failed to persist room state to PostgreSQL ({e}).")

async def delete_room(room_id: str):
    """Delete room state from Redis, PostgreSQL, and In-Memory."""
    clean_id = room_id.upper()
    key = f"{ROOM_KEY_PREFIX}{clean_id}"

    in_memory_rooms.pop(clean_id, None)
    await redis_client.delete(key)

    if is_db_connected and async_session_maker:
        try:
            async with async_session_maker() as db:
                from backend.models import RoomModel
                from sqlalchemy import delete
                await db.execute(delete(RoomModel).where(RoomModel.id == clean_id))
                await db.commit()
        except Exception as e:
            logger.warning(f"Failed to delete room from PostgreSQL ({e}).")

async def list_active_rooms() -> list[dict]:
    """Retrieve all active rooms for public room directory."""
    pattern = f"{ROOM_KEY_PREFIX}*"
    keys = await redis_client.keys(pattern)
    active_rooms = []
    seen_ids = set()
    
    for key in keys:
        room_data = await redis_client.get(key)
        if room_data:
            try:
                state = json.loads(room_data)
                r_id = state.get("roomId")
                if r_id and r_id not in seen_ids:
                    seen_ids.add(r_id)
                    active_rooms.append({
                        "roomId": r_id,
                        "videoUrl": state.get("videoUrl", ""),
                        "provider": state.get("provider", "unknown"),
                        "playing": state.get("playing", False),
                        "membersCount": len(state.get("members", {}))
                    })
            except Exception:
                pass

    for r_id, state in in_memory_rooms.items():
        if r_id not in seen_ids:
            seen_ids.add(r_id)
            active_rooms.append({
                "roomId": r_id,
                "videoUrl": state.get("videoUrl", ""),
                "provider": state.get("provider", "unknown"),
                "playing": state.get("playing", False),
                "membersCount": len(state.get("members", {}))
            })

    return active_rooms
