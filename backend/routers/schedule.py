"""
Schedule API router
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

from models.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/schedules", tags=["schedules"])

VALID_SCHEDULE_TYPES = [
    'maintenance',
    'dispose',
    'lease_return',
    'lease',
    'reserve',
    'move',
    'checkin',
    'checkout',
]

VALID_STATUSES = ['pending', 'completed', 'cancelled']

def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse date string to datetime"""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.get("", response_model=ScheduleResponse)
async def get_schedules(
    assetId: Optional[str] = Query(None, description="Filter by asset ID"),
    startDate: Optional[str] = Query(None, description="Filter by start date"),
    endDate: Optional[str] = Query(None, description="Filter by end date"),
    scheduleType: Optional[str] = Query(None, description="Filter by schedule type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    auth: dict = Depends(verify_auth)
):
    """Get schedules with optional filters"""
    try:
        where: Dict[str, Any] = {}
        
        if assetId:
            where["assetId"] = assetId
        
        if startDate or endDate:
            where["scheduledDate"] = {}
            if startDate:
                parsed_start = parse_date(startDate)
                if parsed_start:
                    where["scheduledDate"]["gte"] = parsed_start
            if endDate:
                parsed_end = parse_date(endDate)
                if parsed_end:
                    where["scheduledDate"]["lte"] = parsed_end
        
        if scheduleType:
            where["scheduleType"] = scheduleType
        
        if status:
            where["status"] = status
        
        schedules_data = await prisma.assetschedule.find_many(
            where=where,
            include={"asset": True},
            order={"scheduledDate": "asc"}
        )
        
        # Format schedules
        schedules = []
        for schedule in schedules_data:
            schedule_dict = {
                "id": str(schedule.id),
                "assetId": str(schedule.assetId),
                "scheduleType": schedule.scheduleType,
                "scheduledDate": schedule.scheduledDate.isoformat() if schedule.scheduledDate and hasattr(schedule.scheduledDate, 'isoformat') else (str(schedule.scheduledDate) if schedule.scheduledDate else None),
                "scheduledTime": schedule.scheduledTime,
                "title": schedule.title,
                "notes": schedule.notes,
                "status": schedule.status,
                "assignedTo": schedule.assignedTo,
                "location": schedule.location,
                "employeeId": str(schedule.employeeId) if schedule.employeeId else None,
                "createdBy": str(schedule.createdBy) if schedule.createdBy else None,
                "createdAt": schedule.createdAt.isoformat() if hasattr(schedule.createdAt, 'isoformat') else str(schedule.createdAt),
                "updatedAt": schedule.updatedAt.isoformat() if schedule.updatedAt and hasattr(schedule.updatedAt, 'isoformat') else (str(schedule.updatedAt) if schedule.updatedAt else None),
                "completedAt": schedule.completedAt.isoformat() if schedule.completedAt and hasattr(schedule.completedAt, 'isoformat') else (str(schedule.completedAt) if schedule.completedAt else None),
                "cancelledAt": schedule.cancelledAt.isoformat() if schedule.cancelledAt and hasattr(schedule.cancelledAt, 'isoformat') else (str(schedule.cancelledAt) if schedule.cancelledAt else None),
                "asset": {
                    "id": str(schedule.asset.id),
                    "assetTagId": str(schedule.asset.assetTagId),
                    "description": str(schedule.asset.description),
                    "status": schedule.asset.status
                } if schedule.asset else None
            }
            schedules.append(schedule_dict)
        
        return ScheduleResponse(
            success=True,
            schedules=schedules
        )
    
    except Exception as e:
        logger.error(f"Error fetching schedules: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch schedules")

@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_data: ScheduleCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new schedule"""
    try:
        # Validation
        if not schedule_data.assetId:
            raise HTTPException(status_code=400, detail="Asset ID is required")
        
        if not schedule_data.scheduleType:
            raise HTTPException(status_code=400, detail="Schedule type is required")
        
        if schedule_data.scheduleType not in VALID_SCHEDULE_TYPES:
            raise HTTPException(status_code=400, detail="Invalid schedule type")
        
        if not schedule_data.scheduledDate:
            raise HTTPException(status_code=400, detail="Scheduled date is required")
        
        if not schedule_data.title:
            raise HTTPException(status_code=400, detail="Title is required")
        
        # Verify asset exists
        asset = await prisma.assets.find_unique(where={"id": schedule_data.assetId})
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Parse scheduled date
        scheduled_date = parse_date(schedule_data.scheduledDate)
        if not scheduled_date:
            raise HTTPException(status_code=400, detail="Invalid scheduled date format")
        
        # Get user ID from auth
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication")
        
        # Create schedule
        schedule = await prisma.assetschedule.create(
            data={
                "assetId": schedule_data.assetId,
                "scheduleType": schedule_data.scheduleType,
                "scheduledDate": scheduled_date,
                "scheduledTime": schedule_data.scheduledTime,
                "title": schedule_data.title,
                "notes": schedule_data.notes,
                "assignedTo": schedule_data.assignedTo,
                "location": schedule_data.location,
                "employeeId": schedule_data.employeeId,
                "status": "pending",
                "createdBy": user_id
            },
            include={"asset": True}
        )
        
        # Format response
        schedule_dict = {
            "id": str(schedule.id),
            "assetId": str(schedule.assetId),
            "scheduleType": schedule.scheduleType,
            "scheduledDate": schedule.scheduledDate.isoformat() if schedule.scheduledDate and hasattr(schedule.scheduledDate, 'isoformat') else (str(schedule.scheduledDate) if schedule.scheduledDate else None),
            "scheduledTime": schedule.scheduledTime,
            "title": schedule.title,
            "notes": schedule.notes,
            "status": schedule.status,
            "assignedTo": schedule.assignedTo,
            "location": schedule.location,
            "employeeId": str(schedule.employeeId) if schedule.employeeId else None,
            "createdBy": str(schedule.createdBy) if schedule.createdBy else None,
            "createdAt": schedule.createdAt.isoformat() if hasattr(schedule.createdAt, 'isoformat') else str(schedule.createdAt),
            "updatedAt": schedule.updatedAt.isoformat() if schedule.updatedAt and hasattr(schedule.updatedAt, 'isoformat') else (str(schedule.updatedAt) if schedule.updatedAt else None),
            "completedAt": schedule.completedAt.isoformat() if schedule.completedAt and hasattr(schedule.completedAt, 'isoformat') else (str(schedule.completedAt) if schedule.completedAt else None),
            "cancelledAt": schedule.cancelledAt.isoformat() if schedule.cancelledAt and hasattr(schedule.cancelledAt, 'isoformat') else (str(schedule.cancelledAt) if schedule.cancelledAt else None),
            "asset": {
                "id": str(schedule.asset.id),
                "assetTagId": str(schedule.asset.assetTagId),
                "description": str(schedule.asset.description)
            } if schedule.asset else None
        }
        
        return ScheduleResponse(
            success=True,
            schedule=schedule_dict
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create schedule: {str(e)}")

@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get a single schedule by ID"""
    try:
        schedule = await prisma.assetschedule.find_unique(
            where={"id": schedule_id},
            include={"asset": True}
        )
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Format response
        schedule_dict = {
            "id": str(schedule.id),
            "assetId": str(schedule.assetId),
            "scheduleType": schedule.scheduleType,
            "scheduledDate": schedule.scheduledDate.isoformat() if schedule.scheduledDate and hasattr(schedule.scheduledDate, 'isoformat') else (str(schedule.scheduledDate) if schedule.scheduledDate else None),
            "scheduledTime": schedule.scheduledTime,
            "title": schedule.title,
            "notes": schedule.notes,
            "status": schedule.status,
            "assignedTo": schedule.assignedTo,
            "location": schedule.location,
            "employeeId": str(schedule.employeeId) if schedule.employeeId else None,
            "createdBy": str(schedule.createdBy) if schedule.createdBy else None,
            "createdAt": schedule.createdAt.isoformat() if hasattr(schedule.createdAt, 'isoformat') else str(schedule.createdAt),
            "updatedAt": schedule.updatedAt.isoformat() if schedule.updatedAt and hasattr(schedule.updatedAt, 'isoformat') else (str(schedule.updatedAt) if schedule.updatedAt else None),
            "completedAt": schedule.completedAt.isoformat() if schedule.completedAt and hasattr(schedule.completedAt, 'isoformat') else (str(schedule.completedAt) if schedule.completedAt else None),
            "cancelledAt": schedule.cancelledAt.isoformat() if schedule.cancelledAt and hasattr(schedule.cancelledAt, 'isoformat') else (str(schedule.cancelledAt) if schedule.cancelledAt else None),
            "asset": {
                "id": str(schedule.asset.id),
                "assetTagId": str(schedule.asset.assetTagId),
                "description": str(schedule.asset.description),
                "status": schedule.asset.status
            } if schedule.asset else None
        }
        
        return ScheduleResponse(
            success=True,
            schedule=schedule_dict
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch schedule")

@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    schedule_data: ScheduleUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update a schedule"""
    try:
        # Check if schedule exists
        existing_schedule = await prisma.assetschedule.find_unique(
            where={"id": schedule_id}
        )
        
        if not existing_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Prepare update data
        update_data: Dict[str, Any] = {}
        
        if schedule_data.scheduleType:
            if schedule_data.scheduleType not in VALID_SCHEDULE_TYPES:
                raise HTTPException(status_code=400, detail="Invalid schedule type")
            update_data["scheduleType"] = schedule_data.scheduleType
        
        if schedule_data.scheduledDate:
            parsed_date = parse_date(schedule_data.scheduledDate)
            if parsed_date:
                update_data["scheduledDate"] = parsed_date
        
        if schedule_data.scheduledTime is not None:
            update_data["scheduledTime"] = schedule_data.scheduledTime
        
        if schedule_data.title is not None:
            update_data["title"] = schedule_data.title
        
        if schedule_data.notes is not None:
            update_data["notes"] = schedule_data.notes
        
        if schedule_data.status:
            if schedule_data.status not in VALID_STATUSES:
                raise HTTPException(status_code=400, detail="Invalid status")
            update_data["status"] = schedule_data.status
            
            # Set completion/cancellation timestamps
            if schedule_data.status == 'completed' and not existing_schedule.completedAt:
                update_data["completedAt"] = datetime.now()
            elif schedule_data.status == 'cancelled' and not existing_schedule.cancelledAt:
                update_data["cancelledAt"] = datetime.now()
        
        if schedule_data.assignedTo is not None:
            update_data["assignedTo"] = schedule_data.assignedTo
        
        if schedule_data.location is not None:
            update_data["location"] = schedule_data.location
        
        if schedule_data.employeeId is not None:
            update_data["employeeId"] = schedule_data.employeeId
        
        # Update schedule
        schedule = await prisma.assetschedule.update(
            where={"id": schedule_id},
            data=update_data,
            include={"asset": True}
        )
        
        # Format response
        schedule_dict = {
            "id": str(schedule.id),
            "assetId": str(schedule.assetId),
            "scheduleType": schedule.scheduleType,
            "scheduledDate": schedule.scheduledDate.isoformat() if schedule.scheduledDate and hasattr(schedule.scheduledDate, 'isoformat') else (str(schedule.scheduledDate) if schedule.scheduledDate else None),
            "scheduledTime": schedule.scheduledTime,
            "title": schedule.title,
            "notes": schedule.notes,
            "status": schedule.status,
            "assignedTo": schedule.assignedTo,
            "location": schedule.location,
            "employeeId": str(schedule.employeeId) if schedule.employeeId else None,
            "createdBy": str(schedule.createdBy) if schedule.createdBy else None,
            "createdAt": schedule.createdAt.isoformat() if hasattr(schedule.createdAt, 'isoformat') else str(schedule.createdAt),
            "updatedAt": schedule.updatedAt.isoformat() if schedule.updatedAt and hasattr(schedule.updatedAt, 'isoformat') else (str(schedule.updatedAt) if schedule.updatedAt else None),
            "completedAt": schedule.completedAt.isoformat() if schedule.completedAt and hasattr(schedule.completedAt, 'isoformat') else (str(schedule.completedAt) if schedule.completedAt else None),
            "cancelledAt": schedule.cancelledAt.isoformat() if schedule.cancelledAt and hasattr(schedule.cancelledAt, 'isoformat') else (str(schedule.cancelledAt) if schedule.cancelledAt else None),
            "asset": {
                "id": str(schedule.asset.id),
                "assetTagId": str(schedule.asset.assetTagId),
                "description": str(schedule.asset.description)
            } if schedule.asset else None
        }
        
        return ScheduleResponse(
            success=True,
            schedule=schedule_dict
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {str(e)}")

@router.delete("/{schedule_id}", response_model=ScheduleResponse)
async def delete_schedule(
    schedule_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a schedule"""
    try:
        # Check if schedule exists
        schedule = await prisma.assetschedule.find_unique(
            where={"id": schedule_id}
        )
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Delete schedule
        await prisma.assetschedule.delete(where={"id": schedule_id})
        
        return ScheduleResponse(
            success=True,
            message="Schedule deleted successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {str(e)}")

