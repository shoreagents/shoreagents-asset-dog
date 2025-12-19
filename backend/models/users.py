"""
Users API Pydantic models
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


class UserPermissions(BaseModel):
    """User permissions model"""
    canDeleteAssets: Optional[bool] = False
    canManageImport: Optional[bool] = False
    canManageExport: Optional[bool] = True
    canCreateAssets: Optional[bool] = True
    canEditAssets: Optional[bool] = True
    canViewAssets: Optional[bool] = True
    canManageEmployees: Optional[bool] = False
    canManageSetup: Optional[bool] = False
    canCheckout: Optional[bool] = True
    canCheckin: Optional[bool] = True
    canReserve: Optional[bool] = True
    canMove: Optional[bool] = False
    canLease: Optional[bool] = False
    canDispose: Optional[bool] = False
    canManageMaintenance: Optional[bool] = False
    canAudit: Optional[bool] = False
    canManageMedia: Optional[bool] = True
    canManageTrash: Optional[bool] = True
    canManageUsers: Optional[bool] = False
    canManageReturnForms: Optional[bool] = False
    canViewReturnForms: Optional[bool] = True
    canManageAccountabilityForms: Optional[bool] = False
    canViewAccountabilityForms: Optional[bool] = True
    canManageReports: Optional[bool] = False
    canManageInventory: Optional[bool] = False


class User(BaseModel):
    """User response model"""
    id: str
    userId: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: str
    isActive: bool
    isApproved: bool
    canDeleteAssets: bool
    canManageImport: bool
    canManageExport: bool
    canCreateAssets: bool
    canEditAssets: bool
    canViewAssets: bool
    canManageEmployees: bool
    canManageSetup: bool
    canCheckout: bool
    canCheckin: bool
    canReserve: bool
    canMove: bool
    canLease: bool
    canDispose: bool
    canManageMaintenance: bool
    canAudit: bool
    canManageMedia: bool
    canManageTrash: bool
    canManageUsers: bool
    canManageReturnForms: bool
    canViewReturnForms: bool
    canManageAccountabilityForms: bool
    canViewAccountabilityForms: bool
    canManageReports: bool
    canManageInventory: bool
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaginationInfo(BaseModel):
    """Pagination info"""
    page: int
    pageSize: int
    total: int
    totalPages: int
    hasNextPage: bool
    hasPreviousPage: bool


class UsersResponse(BaseModel):
    """Response for list users endpoint"""
    users: List[User]
    pagination: PaginationInfo


class UserResponse(BaseModel):
    """Response for single user endpoint"""
    user: User


class CreateUserRequest(BaseModel):
    """Request to create a new user"""
    email: EmailStr
    password: Optional[str] = None
    role: str
    name: Optional[str] = None
    permissions: Optional[UserPermissions] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ['admin', 'user']:
            raise ValueError('Role must be either "admin" or "user"')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v


class CreateUserResponse(BaseModel):
    """Response for create user endpoint"""
    user: User
    generatedPassword: Optional[str] = None
    emailSent: bool = False
    emailError: Optional[str] = None


class UpdateUserRequest(BaseModel):
    """Request to update a user"""
    role: str
    name: Optional[str] = None
    permissions: Optional[UserPermissions] = None
    isActive: Optional[bool] = None
    isApproved: Optional[bool] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ['admin', 'user']:
            raise ValueError('Role must be either "admin" or "user"')
        return v


class DeleteUserResponse(BaseModel):
    """Response for delete user endpoint"""
    success: bool


class SendPasswordResetResponse(BaseModel):
    """Response for send password reset endpoint"""
    message: str
    email: str

