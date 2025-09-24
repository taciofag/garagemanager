from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Garage Manager"
    environment: Literal["development", "production", "test"] = Field(
        default="development", alias="APP_ENV"
    )
    secret_key: str = Field(default="super-secret-key", alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(default=60 * 24)
    algorithm: str = Field(default="HS256")
    database_url: str = Field(
        default=f"sqlite+aiosqlite:///{Path.cwd() / 'garage_manager.db'}",
        alias="DATABASE_URL",
    )
    test_database_url: str = Field(
        default="sqlite+aiosqlite:///:memory:", alias="TEST_DATABASE_URL"
    )
    default_admin_email: str = Field(default="admin@garage.local")
    default_admin_password: str = Field(default="change-me")
    uploads_dir: Path = Field(default=Path.cwd() / "uploads", alias="UPLOADS_DIR")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    settings = Settings()  # type: ignore[call-arg]
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings


settings = get_settings()
