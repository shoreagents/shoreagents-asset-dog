"""
Pydantic models for Checkout API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class AssetUpdateInfo(BaseModel):
    department: Optional[str] = None
    site: Optional[str] = None
    location: Optional[str] = None

class CheckoutCreate(BaseModel):
    assetIds: List[str]
    employeeUserId: str
    checkoutDate: str
    expectedReturnDate: Optional[str] = None
    updates: Optional[Dict[str, AssetUpdateInfo]] = None

class CheckoutResponse(BaseModel):
    success: bool
    checkouts: List[Dict]
    count: int

class CheckoutStatsResponse(BaseModel):
    recentCheckouts: List[Dict]

