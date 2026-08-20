import os
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.config import get_settings

settings = get_settings()

if settings.environment == "development":
    DATABASE_URL = "sqlite+aiosqlite:///./secure_attendance.db"
else:
    # Production should provide a PostgreSQL DATABASE_URL through the deployment environment.
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./secure_attendance.db",
    )

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def initialize_database() -> None:
    """Create current tables and apply small non-destructive compatibility migrations."""

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        if DATABASE_URL.startswith("sqlite"):
            result = await connection.execute(text("PRAGMA table_info(users)"))
            existing_columns = {row[1] for row in result.fetchall()}
        else:
            result = await connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = current_schema() AND table_name = 'users'"
                )
            )
            existing_columns = {row[0] for row in result.fetchall()}

        if DATABASE_URL.startswith("sqlite"):
            result = await connection.execute(text("PRAGMA table_info(enterprises)"))
            enterprise_columns = {row[1] for row in result.fetchall()}
        else:
            result = await connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = current_schema() AND table_name = 'enterprises'"
                )
            )
            enterprise_columns = {row[0] for row in result.fetchall()}

        if "attendance_start_minutes" not in enterprise_columns:
            await connection.execute(
                text("ALTER TABLE enterprises ADD COLUMN attendance_start_minutes INTEGER NOT NULL DEFAULT 540")
            )
        if "annual_leave_days" not in enterprise_columns:
            await connection.execute(
                text("ALTER TABLE enterprises ADD COLUMN annual_leave_days INTEGER NOT NULL DEFAULT 12")
            )
        if "medical_leave_days" not in enterprise_columns:
            await connection.execute(
                text("ALTER TABLE enterprises ADD COLUMN medical_leave_days INTEGER NOT NULL DEFAULT 8")
            )

        if DATABASE_URL.startswith("sqlite"):
            result = await connection.execute(text("PRAGMA table_info(leave_requests)"))
            leave_request_columns = {row[1] for row in result.fetchall()}
        else:
            result = await connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = current_schema() AND table_name = 'leave_requests'"
                )
            )
            leave_request_columns = {row[0] for row in result.fetchall()}
        if "client_request_id" not in leave_request_columns:
            await connection.execute(
                text("ALTER TABLE leave_requests ADD COLUMN client_request_id VARCHAR(64)")
            )
        await connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_leave_requests_client_request_id ON leave_requests(client_request_id)")
        )

        if "hashed_password" not in existing_columns:
            await connection.execute(
                text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR(255) NOT NULL DEFAULT ''")
            )
        if "pin_hash" not in existing_columns:
            await connection.execute(
                text("ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255)")
            )
        if "profile_image_path" not in existing_columns:
            await connection.execute(
                text("ALTER TABLE users ADD COLUMN profile_image_path VARCHAR(512)")
            )
        if "token_version" not in existing_columns:
            await connection.execute(
                text("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0")
            )

        if "onboarded" not in existing_columns:
            await connection.execute(
                text("ALTER TABLE users ADD COLUMN onboarded BOOLEAN NOT NULL DEFAULT FALSE")
            )
        if "employee_id" not in existing_columns:
            await connection.execute(
                text("ALTER TABLE users ADD COLUMN employee_id VARCHAR(255)")
            )
        if "department" not in existing_columns:
            await connection.execute(
                text("ALTER TABLE users ADD COLUMN department VARCHAR(255)")
            )
