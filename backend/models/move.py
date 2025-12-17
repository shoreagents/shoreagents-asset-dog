"""
Pydantic models for Move API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class MoveCreate(BaseModel):
    assetId: str
    moveType: str  # "Location Transfer", "Employee Assignment", "Department Transfer"
    moveDate: str
    location: Optional[str] = None
    employeeUserId: Optional[str] = None
    department: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class MoveResponse(BaseModel):
    success: bool
    move: Dict

class MoveStatsResponse(BaseModel):
    movedTodayCount: int
    recentMoves: List[Dict]

