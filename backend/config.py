import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_url: str = os.getenv("APP_URL", "http://localhost:3000")
    database_url: str = os.getenv("POSTGRES_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/sferium")
    
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = ""
    
    vk_client_id: str = os.getenv("VK_CLIENT_ID", "")
    vk_client_secret: str = os.getenv("VK_CLIENT_SECRET", "")
    vk_redirect_uri: str = os.getenv("VK_REDIRECT_URI", "https://sferium.homes/api/auth/vk/callback")
    
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    google_redirect_uri: str = os.getenv("GOOGLE_REDIRECT_URI", "https://sferium.homes/api/auth/google/callback")
    
    rutube_client_id: str = os.getenv("RUTUBE_CLIENT_ID", "")
    rutube_client_secret: str = os.getenv("RUTUBE_CLIENT_SECRET", "")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
