import sys
import os
# Add backend path to sys.path at the very top
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_path)

import asyncio
import traceback
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker, Base, engine
from app.api.v1.endpoints.auth import signup
from app.schemas.auth import UserCreate

async def run_direct_signup():
    print("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    user_in = UserCreate(
        email="developer_test@acme.com",
        password="developerpassword123",
        organization_name="Acme Dev Tools"
    )

    print("Running signup directly...")
    async with async_session_maker() as session:
        try:
            res = await signup(user_in, db=session)
            print(f"✅ Signup successful: {res.email}, org: {res.organization_id}")
        except Exception as e:
            print("❌ Signup failed!")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_direct_signup())
