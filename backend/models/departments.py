"""
Pydantic models for Departments API
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class Department(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    description: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentsResponse(BaseModel):
    departments: List[Department]

class DepartmentResponse(BaseModel):
    department: Department

