"""
Asset Events API Pydantic models
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AssetInfo(BaseModel):
    """Minimal asset info for event response"""
    id: str
    assetTagId: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class AssetEvent(BaseModel):
    """Asset event/history log model"""
    id: str
    assetId: str
    eventType: str
    field: Optional[str] = None
    changeFrom: Optional[str] = None
    changeTo: Optional[str] = None
    actionBy: Optional[str] = None
    createdAt: datetime
    asset: Optional[AssetInfo] = None

    class Config:
        from_attributes = True


class PaginationInfo(BaseModel):
    """Pagination info"""
    page: int
    pageSize: int
    total: int
    totalPages: int
    hasNextPage: bool
    hasPreviousPage: bool


class AssetEventsResponse(BaseModel):
    """Response for list asset events endpoint"""
    logs: List[AssetEvent]
    uniqueFields: List[str]
    pagination: PaginationInfo


class BulkDeleteRequest(BaseModel):
    """Request to bulk delete events"""
    ids: List[str]


class DeleteResponse(BaseModel):
    """Response for delete operations"""
    success: bool
    message: str

