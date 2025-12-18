"""
Pydantic models for Employees API
"""
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List
from datetime import datetime, date

class AssetInfoForCheckout(BaseModel):
    id: str
    assetTagId: str
    description: str
    status: Optional[str] = None
    category: Optional[dict] = None
    subCategory: Optional[dict] = None
    location: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None

class CheckoutForEmployee(BaseModel):
    id: str
    checkoutDate: date
    expectedReturnDate: Optional[date] = None
    asset: AssetInfoForCheckout
    checkins: Optional[List[dict]] = []

class Employee(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    email: str
    department: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    checkouts: Optional[List[CheckoutForEmployee]] = []

class EmployeeCreate(BaseModel):
    name: str
    email: EmailStr
    department: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: str
    email: EmailStr
    department: Optional[str] = None

class PaginationInfo(BaseModel):
    page: int
    pageSize: int
    total: int
    totalPages: int
    hasNextPage: bool
    hasPreviousPage: bool

class EmployeesResponse(BaseModel):
    employees: List[Employee]
    pagination: PaginationInfo

class EmployeeResponse(BaseModel):
    employee: Employee

