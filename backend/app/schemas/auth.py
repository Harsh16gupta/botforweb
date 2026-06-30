import datetime
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    organization_name: str = Field(..., min_length=2, max_length=100)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    organization_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: str


class OrganizationResponse(BaseModel):
    id: int
    name: str
    api_key: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True
