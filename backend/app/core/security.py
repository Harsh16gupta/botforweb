"""
Security and Cryptography Helpers.
Manages password hashing (bcrypt), token encoding/decoding (JWT), 
and user session validation dependency injection.
"""

from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt, JWTError
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.context import tenant_ctx
from app.models.models import User, Organization

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies that a plain password matches its hash using bcrypt."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generates a bcrypt hash of the password."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JSON Web Token (JWT) with subject as sub."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Dependency injection helper to validate the JWT from request header
    and return the database User model.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
        
    # Set context for RLS
    tenant_ctx.set(user.organization_id)
    if db.bind.dialect.name == "postgresql":
        await db.execute(
            text("SELECT set_config('app.current_org_id', :org_id, false);"),
            {"org_id": str(user.organization_id)}
        )
        
    return user


async def get_tenant_id(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> int:
    """
    Resolves the organization_id from either:
    1. X-API-Key header (public widget)
    2. Authorization Bearer JWT token (admin user)
    Sets the session and ContextVar context for RLS.
    """
    org_id = None
    
    # 1. Check for X-API-Key header
    api_key = request.headers.get("X-API-Key")
    if api_key:
        result = await db.execute(select(Organization).filter(Organization.api_key == api_key))
        org = result.scalars().first()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API Key"
            )
        org_id = org.id
        
    # 2. Check for Bearer Token in Authorization header
    else:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(
                    token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
                )
                email: str = payload.get("sub")
                if email is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Could not validate credentials"
                    )
            except JWTError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials"
                )
                
            result = await db.execute(select(User).filter(User.email == email))
            user = result.scalars().first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials"
                )
            org_id = user.organization_id
            
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials (JWT token or X-API-Key) are required."
        )
        
    # Set context for RLS
    tenant_ctx.set(org_id)
    if db.bind.dialect.name == "postgresql":
        await db.execute(
            text("SELECT set_config('app.current_org_id', :org_id, false);"),
            {"org_id": str(org_id)}
        )
    
    return org_id
