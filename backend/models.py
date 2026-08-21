from sqlalchemy import Column, String, BigInteger, JSON
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True)
    room_id = Column(String, index=True, nullable=False)
    type = Column(String, nullable=False)  # "user" or "system"
    user_id = Column(String, nullable=True)
    name = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    color = Column(String, nullable=True)
    text = Column(String, nullable=False)
    timestamp = Column(BigInteger, nullable=False)  # Epoch milliseconds
    reactions = Column(JSON, default=dict, nullable=True)

class RoomModel(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, index=True)
    state = Column(JSON, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
