from pydantic_settings import BaseSettings
from pydantic import EmailStr
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PageStreak"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "changeme-use-a-real-secret-in-production"

    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/pagestreak"

    # JWT
    JWT_ALGORITHM: str = "HS256"
    # -1 means forever (until manual logout)
    JWT_EXPIRE_MINUTES: int = -1

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    # Sentry
    SENTRY_DSN: Optional[str] = None

    # File limits
    MAX_UPLOAD_SIZE_MB: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
