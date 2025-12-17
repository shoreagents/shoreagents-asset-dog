"""
Pydantic models for Lease Return API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class LeaseReturnAssetUpdate(BaseModel):
    condition: Optional[str] = None
    notes: Optional[str] = None

class LeaseReturnCreate(BaseModel):
    assetIds: List[str]
    returnDate: str
    updates: Optional[Dict[str, LeaseReturnAssetUpdate]] = None

class LeaseReturnResponse(BaseModel):
    success: bool
    returns: List[Dict]
    count: int

class LeaseReturnStatsResponse(BaseModel):
    totalReturned: int
    recentReturns: List[Dict]

