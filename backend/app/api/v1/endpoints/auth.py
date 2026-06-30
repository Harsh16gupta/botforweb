"""
Authentication Endpoints.
Handles signups (onboarding users and organizations), 
standard OAuth2 login token exchanges, and active session fetching.
"""

import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.models.models import User, Organization
from app.schemas.auth import UserCreate, UserResponse, Token

router = APIRouter()


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Onboard a new organization and administrator account.
    """
    # Check if user already exists
    result = await db.execute(select(User).filter(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # 1. Create Organization
    api_key = f"bfw_{secrets.token_urlsafe(32)}"
    new_org = Organization(
        name=user_in.organization_name,
        api_key=api_key,
        subscription_status="active",  # active trial for MVP
    )
    db.add(new_org)
    await db.flush()  # Flush to populate new_org.id

    # 2. Create User
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        organization_id=new_org.id,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    OAuth2 compatible token login, retrieve a JWT access token.
    """
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    access_token = create_access_token(subject=user.email)
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieve current authenticated user.
    """
    return current_user
