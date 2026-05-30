from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# --- Auth ---
class RegisterRequest(BaseModel):
    username: str
    display_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# --- User ---
class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    email: str
    bio: str
    avatar_url: str
    created_at: datetime
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


# --- Post ---
class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = ""


class PostOut(BaseModel):
    id: int
    content: str
    image_url: str
    author: UserOut
    created_at: datetime
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False

    model_config = {"from_attributes": True}


# --- Comment ---
class CommentCreate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: int
    content: str
    author: UserOut
    post_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Generic ---
class MessageResponse(BaseModel):
    message: str


TokenResponse.model_rebuild()
