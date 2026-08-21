import json
import time
import logging
from fastapi import WebSocket, WebSocketDisconnect
from backend.rooms import get_room_state, save_room_state
from backend.chat import save_chat_message, update_chat_message_reactions

logger = logging.getLogger("sferium.ws")

class ConnectionManager:
    def __init__(self):
        # Dict mapping room_id -> dict mapping user_id -> WebSocket
        self.active_connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][user_id] = websocket

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].pop(user_id, None)
            if not self.active_connections[room_id]:
                self.active_connections.pop(room_id, None)

    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            disconnected_users = []
            for uid, ws in self.active_connections[room_id].items():
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected_users.append(uid)
            for uid in disconnected_users:
                self.disconnect(room_id, uid)

manager = ConnectionManager()

async def handle_websocket(websocket: WebSocket, room_id: str, user_id: str):
    clean_room_id = room_id.upper()
    await manager.connect(clean_room_id, user_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            room = await get_room_state(clean_room_id)
            if not room:
                room = {
                    "roomId": clean_room_id,
                    "hostId": user_id,
                    "videoUrl": "",
                    "provider": "direct",
                    "currentTime": 0,
                    "playing": False,
                    "playbackRate": 1.0,
                    "members": {},
                    "chatHistory": []
                }

            if msg_type == "join_room":
                user_info = message.get("user", {})
                room["members"][user_id] = {
                    "id": user_id,
                    "name": user_info.get("name", f"Гость_{user_id[:4]}"),
                    "avatar": user_info.get("avatar", "👤"),
                    "color": user_info.get("color", "#6366f1"),
                    "isHost": (room["hostId"] == user_id)
                }
                await save_room_state(clean_room_id, room)
                await manager.broadcast_to_room(clean_room_id, {
                    "type": "room_state",
                    "state": room
                })

            elif msg_type == "change_video":
                room["videoUrl"] = message.get("videoUrl", "")
                room["provider"] = message.get("provider", "direct")
                room["currentTime"] = 0
                room["playing"] = True
                await save_room_state(clean_room_id, room)
                await manager.broadcast_to_room(clean_room_id, {
                    "type": "room_state",
                    "state": room
                })

            elif msg_type == "media_play":
                room["playing"] = True
                room["currentTime"] = message.get("currentTime", room.get("currentTime", 0))
                await save_room_state(clean_room_id, room)
                await manager.broadcast_to_room(clean_room_id, {
                    "type": "media_play",
                    "currentTime": room["currentTime"],
                    "senderId": user_id
                })

            elif msg_type == "media_pause":
                room["playing"] = False
                room["currentTime"] = message.get("currentTime", room.get("currentTime", 0))
                await save_room_state(clean_room_id, room)
                await manager.broadcast_to_room(clean_room_id, {
                    "type": "media_pause",
                    "currentTime": room["currentTime"],
                    "senderId": user_id
                })

            elif msg_type == "media_seek":
                room["currentTime"] = message.get("currentTime", 0)
                await save_room_state(clean_room_id, room)
                await manager.broadcast_to_room(clean_room_id, {
                    "type": "media_seek",
                    "currentTime": room["currentTime"],
                    "senderId": user_id
                })

            elif msg_type == "send_chat_message":
                text = message.get("text", "").strip()
                if text:
                    msg_id = f"msg_{int(time.time() * 1000)}_{user_id[:4]}"
                    timestamp = int(time.time() * 1000)
                    member = room.get("members", {}).get(user_id, {})
                    
                    chat_item = {
                        "id": msg_id,
                        "type": "user",
                        "userId": user_id,
                        "name": member.get("name", "Участник"),
                        "avatar": member.get("avatar", "👤"),
                        "color": member.get("color", "#6366f1"),
                        "text": text,
                        "timestamp": timestamp,
                        "reactions": {}
                    }
                    
                    room.setdefault("chatHistory", []).append(chat_item)
                    await save_room_state(clean_room_id, room)
                    await save_chat_message(
                        None,
                        msg_id=msg_id,
                        room_id=clean_room_id,
                        msg_type="user",
                        user_id=user_id,
                        name=member.get("name"),
                        avatar=member.get("avatar"),
                        color=member.get("color"),
                        text=text,
                        timestamp=timestamp
                    )
                    
                    await manager.broadcast_to_room(clean_room_id, {
                        "type": "chat_message",
                        "message": chat_item
                    })

            elif msg_type == "sync_request":
                await websocket.send_json({
                    "type": "room_state",
                    "state": room
                })

    except WebSocketDisconnect:
        manager.disconnect(clean_room_id, user_id)
        room = await get_room_state(clean_room_id)
        if room and user_id in room.get("members", {}):
            room["members"].pop(user_id, None)
            if room["members"] and room["hostId"] == user_id:
                room["hostId"] = next(iter(room["members"].keys()))
                room["members"][room["hostId"]]["isHost"] = True
            await save_room_state(clean_room_id, room)
            await manager.broadcast_to_room(clean_room_id, {
                "type": "room_state",
                "state": room
            })
    except Exception as e:
        logger.error(f"WebSocket error in room {clean_room_id} user {user_id}: {e}")
        manager.disconnect(clean_room_id, user_id)
