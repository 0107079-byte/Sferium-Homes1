import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.config import settings
from backend.models import Base

logger = logging.getLogger("sferium.db")

raw_pg_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or settings.database_url

if raw_pg_url.startswith("postgres://"):
    pg_url = raw_pg_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif raw_pg_url.startswith("postgresql://") and not raw_pg_url.startswith("postgresql+asyncpg://"):
    pg_url = raw_pg_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    pg_url = raw_pg_url

engine = None
async_session_maker = None
is_db_connected = False

try:
    engine = create_async_engine(pg_url, echo=False, connect_args={"timeout": 5})
    async_session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
except Exception as e:
    logger.warning(f"Failed to create PostgreSQL engine: {e}")

async def get_db():
    if not is_db_connected or not async_session_maker:
        yield None
        return
    try:
        async with async_session_maker() as session:
            yield session
    except Exception as e:
        logger.error(f"Error providing DB session: {e}")
        yield None

async def init_db() -> bool:
    global is_db_connected
    if not engine:
        is_db_connected = False
        logger.warning("PostgreSQL engine not available. Operating in In-Memory mode.")
        return False
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        is_db_connected = True
        logger.info("Successfully connected to PostgreSQL database and initialized tables.")
        return True
    except Exception as e:
        is_db_connected = False
        logger.warning(f"PostgreSQL connection failed ({e}). Automatically switching to In-Memory mode.")
        return False
