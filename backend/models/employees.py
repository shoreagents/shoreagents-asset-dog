"""
Pydantic models for Employees API
"""
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List
from datetime import datetime

class Employee(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    email: str
    department: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

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

