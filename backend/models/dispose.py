"""
Pydantic models for Dispose API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class DisposeAssetUpdate(BaseModel):
    disposeValue: Optional[float] = None
    notes: Optional[str] = None

class DisposeCreate(BaseModel):
    assetIds: List[str]
    disposeDate: str
    disposeReason: str  # Disposal method: Sold, Donated, Scrapped, Lost/Missing, Destroyed
    disposeReasonText: Optional[str] = None
    disposeValue: Optional[float] = None
    updates: Optional[Dict[str, DisposeAssetUpdate]] = None

class DisposeResponse(BaseModel):
    success: bool
    disposals: List[Dict]
    count: int

class DisposeStatsResponse(BaseModel):
    disposedTodayCount: int
    recentDisposals: List[Dict]

