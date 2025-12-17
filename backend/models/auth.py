"""
Pydantic models for authentication operations
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    user: Dict[str, Any]
    session: Dict[str, Any]


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class SignupResponse(BaseModel):
    message: str
    user: Dict[str, str]


class LogoutResponse(BaseModel):
    message: str


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str = Field(..., min_length=8)


class ChangePasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    code: str
    password: str = Field(..., min_length=8)


class ResetPasswordResponse(BaseModel):
    message: str


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None  # Will be rejected in the endpoint


class UserResponse(BaseModel):
    user: Dict[str, Any]
    role: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None
    isActive: bool = True

