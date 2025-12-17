"""
Pydantic models for Checkin API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict

class CheckinAssetUpdate(BaseModel):
    condition: Optional[str] = None
    notes: Optional[str] = None
    returnLocation: Optional[str] = None

class CheckinCreate(BaseModel):
    assetIds: List[str]
    checkinDate: str
    updates: Optional[Dict[str, CheckinAssetUpdate]] = None

class CheckinResponse(BaseModel):
    success: bool
    checkins: List[Dict]
    count: int

class CheckinStatsResponse(BaseModel):
    recentCheckins: List[Dict]

