"""
Pydantic models for Lease API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class LeaseCreate(BaseModel):
    assetId: str
    lessee: str
    leaseStartDate: str
    leaseEndDate: Optional[str] = None
    conditions: Optional[str] = None
    notes: Optional[str] = None

class LeaseResponse(BaseModel):
    success: bool
    lease: Dict

class LeaseStatsResponse(BaseModel):
    totalLeased: int
    recentLeases: List[Dict]

