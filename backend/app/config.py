from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the local attendance API."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Facial Recognition Attendance API"
    environment: Literal["development", "staging", "production"] = "development"
    cors_allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    attendance_retention_mode: Literal["local-only", "approved-evidence"] = "local-only"
    attendance_late_after_minutes: int = Field(default=9 * 60, ge=0, le=24 * 60 - 1)
    app_timezone: str = "Asia/Karachi"
    max_evidence_bytes: int = Field(default=6 * 1024 * 1024, ge=1024, le=25 * 1024 * 1024)
    max_employee_id_length: int = Field(default=128, ge=1, le=255)
    valkey_url: str = "redis://valkey:6379/0"
    cache_enabled: bool = True
    cache_ttl_seconds: int = Field(default=30, ge=1, le=3600)

    # Rate-limit settings are intentionally configurable for different edge
    # deployments. A shared limiter should replace the process-local fallback
    # when running more than one API replica.
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    rate_limit_max_backoff_seconds: int = Field(default=900, ge=1, le=86_400)
    public_rate_limit_per_ip: int = Field(default=60, ge=1, le=10_000)
    authenticated_rate_limit_per_account: int = Field(default=120, ge=1, le=10_000)
    pin_rate_limit_per_account: int = Field(default=5, ge=1, le=1000)
    auth_rate_limit_per_ip: int = Field(default=10, ge=1, le=10_000)
    auth_rate_limit_per_account: int = Field(default=5, ge=1, le=10_000)
    demo_rate_limit_per_ip: int = Field(default=10, ge=1, le=10_000)

    employee_face_threshold: float = Field(default=0.5, ge=0.05, le=1.0)

    # Authentication secrets are mandatory outside development and are never
    # bundled into the frontend or mobile applications.
    jwt_secret: SecretStr | None = None
    password_pepper: SecretStr | None = None

    evidence_storage_dir: str = "./var/facial-recognition-attendance/evidence"

    # Realtime notifications use a process-local hub for the local application.
    notifications_enabled: bool = True
    notification_ws_path: str = "/v1/notifications/ws"
    notification_ws_token: SecretStr | None = None
    notification_ws_allow_unauthenticated_development: bool = False

    # Analytics models are checked daily and trained once attendance spans this period.
    analytics_min_data_days: int = Field(default=30, ge=30, le=3650)
    analytics_training_interval_seconds: int = Field(default=86_400, ge=3_600, le=604_800)


@lru_cache
def get_settings() -> Settings:
    return Settings()
