"""
Asset Events API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Path, Body
from typing import Optional, List
import logging

from models.asset_events import (
    AssetEvent,
    AssetInfo,
    AssetEventsResponse,
    BulkDeleteRequest,
    DeleteResponse,
    PaginationInfo,
)
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings/asset-events", tags=["asset-events"])


def event_to_response(db_event) -> AssetEvent:
    """Convert database event to response model"""
    asset_info = None
    if db_event.asset:
        asset_info = AssetInfo(
            id=db_event.asset.id,
            assetTagId=db_event.asset.assetTagId,
            description=db_event.asset.description,
        )
    
    return AssetEvent(
        id=db_event.id,
        assetId=db_event.assetId,
        eventType=db_event.eventType,
        field=db_event.field,
        changeFrom=db_event.changeFrom,
        changeTo=db_event.changeTo,
        actionBy=db_event.actionBy,
        createdAt=db_event.createdAt,
        asset=asset_info,
    )


@router.get("", response_model=AssetEventsResponse)
async def get_asset_events(
    search: Optional[str] = Query(None, description="Search term"),
    eventType: Optional[str] = Query(None, description="Filter by event type"),
    field: Optional[str] = Query(None, description="Filter by field"),
    page: int = Query(1, ge=1, description="Page number"),
    pageSize: int = Query(50, ge=1, le=100, description="Page size"),
    auth: dict = Depends(verify_auth)
):
    """Get all asset events with pagination and filtering"""
    try:
        skip = (page - 1) * pageSize
        
        # Build where clause
        where_clause = {}
        
        # Search filter
        if search:
            where_clause["OR"] = [
                {"actionBy": {"contains": search, "mode": "insensitive"}},
                {"field": {"contains": search, "mode": "insensitive"}},
                {"changeFrom": {"contains": search, "mode": "insensitive"}},
                {"changeTo": {"contains": search, "mode": "insensitive"}},
                {"asset": {"assetTagId": {"contains": search, "mode": "insensitive"}}},
                {"asset": {"description": {"contains": search, "mode": "insensitive"}}},
            ]
        
        # Event type filter
        if eventType and eventType != "all":
            where_clause["eventType"] = eventType
        
        # Field filter
        if field and field != "all":
            where_clause["field"] = field
        
        # Get total count
        total_count = await prisma.assetshistorylogs.count(
            where=where_clause if where_clause else None
        )
        
        # Get events with pagination
        db_events = await prisma.assetshistorylogs.find_many(
            where=where_clause if where_clause else None,
            include={"asset": True},
            order={"createdAt": "desc"},
            skip=skip,
            take=pageSize,
        )
        
        # Get unique field values for filter dropdown
        all_events_with_fields = await prisma.assetshistorylogs.find_many(
            where={"field": {"not": None}},
        )
        
        # Extract unique fields
        unique_fields_set = set()
        for e in all_events_with_fields:
            if e.field and e.field != "":
                unique_fields_set.add(e.field)
        
        unique_fields = sorted(list(unique_fields_set))
        
        # Convert to response models
        events = [event_to_response(e) for e in db_events]
        
        total_pages = (total_count + pageSize - 1) // pageSize if total_count > 0 else 1
        
        return AssetEventsResponse(
            logs=events,
            uniqueFields=unique_fields,
            pagination=PaginationInfo(
                page=page,
                pageSize=pageSize,
                total=total_count,
                totalPages=total_pages,
                hasNextPage=page < total_pages,
                hasPreviousPage=page > 1,
            )
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset events: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset events")


@router.delete("/bulk-delete", response_model=DeleteResponse)
async def bulk_delete_events(
    request: BulkDeleteRequest = Body(...),
    auth: dict = Depends(verify_auth)
):
    """Bulk delete asset events"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="IDs array is required")
        
        # Delete events
        result = await prisma.assetshistorylogs.delete_many(
            where={"id": {"in": request.ids}}
        )
        
        count = len(request.ids)
        return DeleteResponse(
            success=True,
            message=f"{count} event{'s' if count > 1 else ''} deleted successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting asset events: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete asset events")


@router.delete("/{event_id}", response_model=DeleteResponse)
async def delete_event(
    event_id: str = Path(..., description="Event ID"),
    auth: dict = Depends(verify_auth)
):
    """Delete a single asset event"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check if event exists
        event = await prisma.assetshistorylogs.find_unique(where={"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Delete event
        await prisma.assetshistorylogs.delete(where={"id": event_id})
        
        return DeleteResponse(
            success=True,
            message="Event deleted successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting asset event: {type(e).__name__}: {str(e)}", exc_info=True)
        if "p2025" in str(e).lower():
            raise HTTPException(status_code=404, detail="Event not found")
        raise HTTPException(status_code=500, detail="Failed to delete asset event")

