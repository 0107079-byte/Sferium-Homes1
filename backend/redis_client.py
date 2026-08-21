import os
import logging
import fnmatch
from redis.asyncio import Redis, from_url
from backend.config import settings

logger = logging.getLogger("sferium.redis")

class RedisClient:
    def __init__(self):
        self._client: Redis | None = None
        self._fallback_db: dict[str, str] = {}
        self.is_connected = False

    async def connect(self):
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            if settings.redis_password:
                redis_url = f"redis://:{settings.redis_password}@{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
            else:
                redis_url = f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
        
        try:
            self._client = from_url(redis_url, decode_responses=True, socket_connect_timeout=3)
            await self._client.ping()
            self.is_connected = True
            logger.info(f"Connected to Redis successfully ({redis_url})!")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis ({e}). Using in-memory fallback cache.")
            self._client = None
            self.is_connected = False

    async def set(self, key: str, value: str, expire: int | None = None):
        if self.is_connected and self._client:
            try:
                await self._client.set(key, value, ex=expire)
                return
            except Exception as e:
                logger.error(f"Redis set failed ({e}). Falling back to in-memory.")
                self.is_connected = False
        self._fallback_db[key] = value

    async def get(self, key: str) -> str | None:
        if self.is_connected and self._client:
            try:
                return await self._client.get(key)
            except Exception as e:
                logger.error(f"Redis get failed ({e}). Falling back to in-memory.")
                self.is_connected = False
        return self._fallback_db.get(key)

    async def delete(self, key: str):
        if self.is_connected and self._client:
            try:
                await self._client.delete(key)
                return
            except Exception as e:
                logger.error(f"Redis delete failed ({e}). Falling back to in-memory.")
                self.is_connected = False
        self._fallback_db.pop(key, None)

    async def keys(self, pattern: str) -> list[str]:
        if self.is_connected and self._client:
            try:
                return await self._client.keys(pattern)
            except Exception as e:
                logger.error(f"Redis keys failed ({e}). Falling back to in-memory.")
                self.is_connected = False
        
        return [k for k in self._fallback_db.keys() if fnmatch.fnmatch(k, pattern)]

redis_client = RedisClient()
