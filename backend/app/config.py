from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Password reset
    RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # App
    APP_NAME: str = "QTrack"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # SMTP
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_PORT: int = 587
    MAIL_SERVER: str = ""
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    # File storage
    UPLOAD_DIR: str = "uploads"
    QR_DIR: str = "uploads/qr"
    LABEL_DIR: str = "uploads/labels"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
