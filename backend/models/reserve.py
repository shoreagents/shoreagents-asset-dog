"""
Pydantic models for Reserve API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class ReserveCreate(BaseModel):
    assetId: str
    reservationType: str  # "Employee" or "Department"
    reservationDate: str
    employeeUserId: Optional[str] = None
    department: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None

class ReserveResponse(BaseModel):
    success: bool
    reservation: Dict

class ReserveStatsResponse(BaseModel):
    totalReserved: int
    recentReservations: List[Dict]

