"""
Pydantic models for Maintenance API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class MaintenanceInventoryItem(BaseModel):
    inventoryItemId: str
    quantity: float
    unitCost: Optional[float] = None

class MaintenanceCreate(BaseModel):
    assetId: str
    title: str
    details: Optional[str] = None
    dueDate: Optional[str] = None
    maintenanceBy: Optional[str] = None
    status: str
    dateCompleted: Optional[str] = None
    dateCancelled: Optional[str] = None
    cost: Optional[str] = None
    isRepeating: bool = False
    inventoryItems: Optional[List[MaintenanceInventoryItem]] = None

class MaintenanceResponse(BaseModel):
    success: bool
    maintenance: Dict

class MaintenanceStatsResponse(BaseModel):
    scheduledTodayCount: int
    inProgressCount: int
    recentMaintenances: List[Dict]

