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

class MaintenanceUpdate(BaseModel):
    id: str
    title: Optional[str] = None
    details: Optional[str] = None
    dueDate: Optional[str] = None
    maintenanceBy: Optional[str] = None
    status: Optional[str] = None
    dateCompleted: Optional[str] = None
    dateCancelled: Optional[str] = None
    cost: Optional[str] = None
    isRepeating: Optional[bool] = None
    inventoryItems: Optional[List[MaintenanceInventoryItem]] = None

class MaintenanceResponse(BaseModel):
    success: bool
    maintenance: Dict

class MaintenancesListResponse(BaseModel):
    maintenances: List[Dict]
    pagination: Optional[Dict] = None

class MaintenanceDeleteResponse(BaseModel):
    success: bool
    message: Optional[str] = None

class MaintenanceStatsResponse(BaseModel):
    scheduledTodayCount: int
    inProgressCount: int
    recentMaintenances: List[Dict]

