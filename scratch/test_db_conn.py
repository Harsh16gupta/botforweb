import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/botforweb"

async def test_conn():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_async_engine(DATABASE_URL)
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT 1;"))
            val = res.scalar()
            print(f"✅ Connection successful! SELECT 1 returned: {val}")
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_conn())
