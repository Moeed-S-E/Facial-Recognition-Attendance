import asyncio
from sqlalchemy import text
from app.database import engine
from sqlalchemy.exc import SQLAlchemyError

async def migrate():
    async with engine.begin() as conn:
        try:
            # Check if sqlite or postgres
            is_sqlite = engine.url.drivername.startswith("sqlite")
            
            if is_sqlite:
                await conn.execute(text("ALTER TABLE users ADD COLUMN onboarded BOOLEAN DEFAULT FALSE;"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN employee_id VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN department VARCHAR(255);"))
            else:
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT FALSE;"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);"))
            
            print("Migration successful.")
        except SQLAlchemyError as e:
            # SQLite throws an error if column already exists
            print(f"Migration error (might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
