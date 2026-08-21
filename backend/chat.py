import logging
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import ChatMessageModel
from backend.db import async_session_maker, is_db_connected

logger = logging.getLogger("sferium.chat")

async def save_chat_message(
    db: AsyncSession | None,
    msg_id: str,
    room_id: str,
    msg_type: str,
    user_id: str | None,
    name: str | None,
    avatar: str | None,
    color: str | None,
    text: str,
    timestamp: int,
    reactions: dict | None = None
) -> ChatMessageModel | None:
    """Save a single user or system message to PostgreSQL database if connected."""
    if not is_db_connected or not async_session_maker:
        return None
    try:
        if db is not None:
            return await _persist_msg(db, msg_id, room_id, msg_type, user_id, name, avatar, color, text, timestamp, reactions)
        else:
            async with async_session_maker() as session:
                return await _persist_msg(session, msg_id, room_id, msg_type, user_id, name, avatar, color, text, timestamp, reactions)
    except Exception as e:
        logger.warning(f"Failed to persist chat message to PostgreSQL ({e}).")
        return None

async def _persist_msg(session: AsyncSession, msg_id: str, room_id: str, msg_type: str, user_id: str | None, name: str | None, avatar: str | None, color: str | None, text: str, timestamp: int, reactions: dict | None = None):
    db_msg = ChatMessageModel(
        id=msg_id,
        room_id=room_id,
        type=msg_type,
        user_id=user_id,
        name=name,
        avatar=avatar,
        color=color,
        text=text,
        timestamp=timestamp,
        reactions=reactions or {}
    )
    session.add(db_msg)
    await session.commit()
    return db_msg

async def get_chat_history(db: AsyncSession | None, room_id: str, limit: int = 50) -> list[dict]:
    """Fetch latest messages from database for a specific room if connected."""
    if not is_db_connected or not async_session_maker:
        return []
    try:
        if db is not None:
            return await _fetch_history(db, room_id, limit)
        else:
            async with async_session_maker() as session:
                return await _fetch_history(session, room_id, limit)
    except Exception as e:
        logger.warning(f"Failed to fetch chat history from PostgreSQL ({e}).")
        return []

async def _fetch_history(session: AsyncSession, room_id: str, limit: int = 50) -> list[dict]:
    result = await session.execute(
        select(ChatMessageModel)
        .where(ChatMessageModel.room_id == room_id)
        .order_by(ChatMessageModel.timestamp.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return [
        {
            "id": msg.id,
            "type": msg.type,
            "userId": msg.user_id,
            "name": msg.name,
            "avatar": msg.avatar,
            "color": msg.color,
            "text": msg.text,
            "timestamp": msg.timestamp,
            "reactions": msg.reactions or {}
        }
        for msg in messages
    ]

async def update_chat_message_reactions(db: AsyncSession | None, msg_id: str, reactions: dict):
    """Update reactions dict on a message in PostgreSQL if connected."""
    if not is_db_connected or not async_session_maker:
        return
    try:
        if db is not None:
            await _update_reactions(db, msg_id, reactions)
        else:
            async with async_session_maker() as session:
                await _update_reactions(session, msg_id, reactions)
    except Exception as e:
        logger.warning(f"Failed to update chat message reactions in PostgreSQL ({e}).")

async def _update_reactions(session: AsyncSession, msg_id: str, reactions: dict):
    await session.execute(
        update(ChatMessageModel)
        .where(ChatMessageModel.id == msg_id)
        .values(reactions=reactions)
    )
    await session.commit()
