"""
Pydantic models for Schedule API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class ScheduleCreate(BaseModel):
    assetId: str
    scheduleType: str
    scheduledDate: str
    scheduledTime: Optional[str] = None
    title: str
    notes: Optional[str] = None
    assignedTo: Optional[str] = None
    location: Optional[str] = None
    employeeId: Optional[str] = None

class ScheduleUpdate(BaseModel):
    scheduleType: Optional[str] = None
    scheduledDate: Optional[str] = None
    scheduledTime: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    assignedTo: Optional[str] = None
    location: Optional[str] = None
    employeeId: Optional[str] = None

class ScheduleResponse(BaseModel):
    success: bool
    schedule: Optional[Dict] = None
    schedules: Optional[List[Dict]] = None
    message: Optional[str] = None

