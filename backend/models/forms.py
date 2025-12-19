"""
Forms API Pydantic models
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class EmployeeInfo(BaseModel):
    """Employee user info for form response"""
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None

    class Config:
        from_attributes = True


class AccountabilityForm(BaseModel):
    """Accountability form model"""
    id: str
    employeeUserId: str
    dateIssued: datetime
    department: Optional[str] = None
    accountabilityFormNo: Optional[str] = None
    formData: Optional[Dict[str, Any]] = None
    employeeUser: Optional[EmployeeInfo] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReturnForm(BaseModel):
    """Return form model"""
    id: str
    employeeUserId: str
    dateReturned: datetime
    department: Optional[str] = None
    ctrlNo: Optional[str] = None
    returnType: Optional[str] = "Return to Office"
    formData: Optional[Dict[str, Any]] = None
    employeeUser: Optional[EmployeeInfo] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class AccountabilityFormsResponse(BaseModel):
    """Response for accountability forms list"""
    accountabilityForms: List[AccountabilityForm]


class ReturnFormsResponse(BaseModel):
    """Response for return forms list"""
    returnForms: List[ReturnForm]


class CreateAccountabilityFormRequest(BaseModel):
    """Request to create accountability form"""
    employeeUserId: str
    dateIssued: str  # ISO date string
    department: Optional[str] = None
    accountabilityFormNo: Optional[str] = None
    formData: Optional[Dict[str, Any]] = None


class CreateReturnFormRequest(BaseModel):
    """Request to create return form"""
    employeeUserId: str
    dateReturned: str  # ISO date string
    department: Optional[str] = None
    ctrlNo: Optional[str] = None
    returnType: Optional[str] = "Return to Office"
    formData: Optional[Dict[str, Any]] = None


class AccountabilityFormResponse(BaseModel):
    """Response for single accountability form"""
    accountabilityForm: AccountabilityForm


class ReturnFormResponse(BaseModel):
    """Response for single return form"""
    returnForm: ReturnForm


class PaginationInfo(BaseModel):
    """Pagination info"""
    page: int
    pageSize: int
    total: int
    totalPages: int
    hasNextPage: bool
    hasPreviousPage: bool


class FormHistoryCounts(BaseModel):
    """Form history counts"""
    returnForms: int
    accountabilityForms: int


class FormHistoryResponse(BaseModel):
    """Response for form history"""
    returnForms: Optional[List[ReturnForm]] = None
    accountabilityForms: Optional[List[AccountabilityForm]] = None
    pagination: PaginationInfo
    counts: FormHistoryCounts


class DeleteFormResponse(BaseModel):
    """Response for delete form"""
    message: str

