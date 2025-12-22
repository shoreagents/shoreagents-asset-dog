"""
Automated Reports API router
"""
from fastapi import APIRouter, HTTPException, Depends, Path
from typing import List, Dict, Any, Optional
import logging
import json
from datetime import datetime

from models.automated_reports import (
    AutomatedReportScheduleCreate,
    AutomatedReportScheduleUpdate,
    AutomatedReportScheduleResponse,
    AutomatedReportScheduleListResponse,
    AutomatedReportScheduleDeleteResponse,
    AutomatedReportSchedule
)
from auth import verify_auth
from database import prisma
from utils.report_schedule import calculate_next_run_at
from prisma_client._fields import Json as PrismaJson

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports/automated", tags=["reports"])

@router.get("", response_model=AutomatedReportScheduleListResponse)
async def get_automated_reports(
    auth: dict = Depends(verify_auth)
):
    """Get all automated report schedules"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        schedules_raw = await prisma.automatedreportschedule.find_many(
            order={"createdAt": "desc"}
        )

        schedules = [
            AutomatedReportSchedule(
                id=schedule.id,
                reportName=schedule.reportName,
                reportType=schedule.reportType,
                frequency=schedule.frequency,
                frequencyDay=schedule.frequencyDay,
                frequencyMonth=schedule.frequencyMonth,
                scheduledTime=schedule.scheduledTime,
                emailRecipients=schedule.emailRecipients,
                filters=schedule.filters,
                format=schedule.format,
                includeList=schedule.includeList,
                isActive=schedule.isActive,
                lastSentAt=schedule.lastSentAt,
                nextRunAt=schedule.nextRunAt,
                createdBy=schedule.createdBy,
                createdAt=schedule.createdAt,
                updatedAt=schedule.updatedAt,
            )
            for schedule in schedules_raw
        ]

        return AutomatedReportScheduleListResponse(schedules=schedules)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching automated report schedules: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch automated report schedules")

@router.post("", response_model=AutomatedReportScheduleResponse, status_code=201)
async def create_automated_report(
    data: AutomatedReportScheduleCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new automated report schedule"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Validate required fields
        if not data.reportName or not data.reportType or not data.frequency or not data.emailRecipients or len(data.emailRecipients) == 0:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Validate email format (Pydantic already validates this, but double-check)
        import re
        email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        for email in data.emailRecipients:
            if not email_regex.match(email):
                raise HTTPException(status_code=400, detail=f"Invalid email address: {email}")

        # Calculate next run time
        final_scheduled_time = data.scheduledTime or '02:00'
        next_run_at = calculate_next_run_at(
            frequency=data.frequency,
            frequency_day=data.frequencyDay,
            frequency_month=data.frequencyMonth,
            scheduled_time=final_scheduled_time
        )

        # Get user name from auth
        user = auth.get("user", {})
        user_name = (
            user.get("user_metadata", {}).get("name") or
            user.get("user_metadata", {}).get("full_name") or
            user.get("email", "").split("@")[0] if user.get("email") else
            user.get("email") or
            user_id
        )

        # Prepare filters - use model_dump to get JSON-serializable values
        # Prisma Client Python requires JSON fields to be plain Python dicts
        data_dict = data.model_dump(mode='json', exclude_unset=False)
        filters_value = data_dict.get('filters')
        
        # Convert filters to plain Python dict
        if filters_value is None:
            filters_plain = None
        elif isinstance(filters_value, dict):
            # Already a dict from model_dump, but ensure it's a plain dict
            filters_plain = dict(filters_value) if filters_value else {}
        else:
            filters_plain = {}
        
        # Create schedule
        create_data = {
            "reportName": data.reportName,
            "reportType": data.reportType,
            "frequency": data.frequency,
            "frequencyDay": data.frequencyDay,
            "frequencyMonth": data.frequencyMonth,
            "scheduledTime": final_scheduled_time,
            "emailRecipients": data.emailRecipients,
            "format": data.format or 'pdf',
            "includeList": data.includeList if data.includeList is not None else True,
            "isActive": True,
            "nextRunAt": next_run_at,
            "createdBy": user_name,
        }
        
        # Only include filters if it's not None (Prisma handles None for nullable JSON fields)
        if filters_plain is not None:
            create_data["filters"] = filters_plain
        
        schedule_raw = await prisma.automatedreportschedule.create(data=create_data)

        schedule = AutomatedReportSchedule(
            id=schedule_raw.id,
            reportName=schedule_raw.reportName,
            reportType=schedule_raw.reportType,
            frequency=schedule_raw.frequency,
            frequencyDay=schedule_raw.frequencyDay,
            frequencyMonth=schedule_raw.frequencyMonth,
            scheduledTime=schedule_raw.scheduledTime,
            emailRecipients=schedule_raw.emailRecipients,
            filters=schedule_raw.filters,
            format=schedule_raw.format,
            includeList=schedule_raw.includeList,
            isActive=schedule_raw.isActive,
            lastSentAt=schedule_raw.lastSentAt,
            nextRunAt=schedule_raw.nextRunAt,
            createdBy=schedule_raw.createdBy,
            createdAt=schedule_raw.createdAt,
            updatedAt=schedule_raw.updatedAt,
        )

        return AutomatedReportScheduleResponse(schedule=schedule)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating automated report schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create automated report schedule")

@router.get("/{schedule_id}", response_model=AutomatedReportScheduleResponse)
async def get_automated_report(
    schedule_id: str = Path(..., description="Schedule ID"),
    auth: dict = Depends(verify_auth)
):
    """Get a single automated report schedule"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        schedule_raw = await prisma.automatedreportschedule.find_unique(
            where={"id": schedule_id}
        )

        if not schedule_raw:
            raise HTTPException(status_code=404, detail="Schedule not found")

        schedule = AutomatedReportSchedule(
            id=schedule_raw.id,
            reportName=schedule_raw.reportName,
            reportType=schedule_raw.reportType,
            frequency=schedule_raw.frequency,
            frequencyDay=schedule_raw.frequencyDay,
            frequencyMonth=schedule_raw.frequencyMonth,
            scheduledTime=schedule_raw.scheduledTime,
            emailRecipients=schedule_raw.emailRecipients,
            filters=schedule_raw.filters,
            format=schedule_raw.format,
            includeList=schedule_raw.includeList,
            isActive=schedule_raw.isActive,
            lastSentAt=schedule_raw.lastSentAt,
            nextRunAt=schedule_raw.nextRunAt,
            createdBy=schedule_raw.createdBy,
            createdAt=schedule_raw.createdAt,
            updatedAt=schedule_raw.updatedAt,
        )

        return AutomatedReportScheduleResponse(schedule=schedule)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching automated report schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch automated report schedule")

@router.put("/{schedule_id}", response_model=AutomatedReportScheduleResponse)
async def update_automated_report(
    schedule_id: str = Path(..., description="Schedule ID"),
    data: AutomatedReportScheduleUpdate = ...,
    auth: dict = Depends(verify_auth)
):
    """Update an automated report schedule"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Check if schedule exists
        current_schedule = await prisma.automatedreportschedule.find_unique(
            where={"id": schedule_id}
        )

        if not current_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # Validate email format if emailRecipients is provided
        if data.emailRecipients is not None:
            import re
            email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
            for email in data.emailRecipients:
                if not email_regex.match(email):
                    raise HTTPException(status_code=400, detail=f"Invalid email address: {email}")

        # Build update data
        update_data = {}
        
        if data.reportName is not None:
            update_data["reportName"] = data.reportName
        if data.reportType is not None:
            update_data["reportType"] = data.reportType
        if data.frequency is not None:
            update_data["frequency"] = data.frequency
        if data.frequencyDay is not None:
            update_data["frequencyDay"] = data.frequencyDay
        if data.frequencyMonth is not None:
            update_data["frequencyMonth"] = data.frequencyMonth
        if data.scheduledTime is not None:
            update_data["scheduledTime"] = data.scheduledTime
        if data.emailRecipients is not None:
            update_data["emailRecipients"] = data.emailRecipients
        # Handle filters field - Prisma Client Python requires Json wrapper for updates
        # This is different from create operations
        if data.filters is not None:
            # Convert filters to plain Python dict via JSON round-trip
            filters_dict = data.filters if isinstance(data.filters, dict) else {}
            filters_plain = json.loads(json.dumps(filters_dict, default=str)) if filters_dict else {}
            # Wrap in PrismaJson for update operations
            update_data["filters"] = PrismaJson(filters_plain)
        if data.format is not None:
            update_data["format"] = data.format
        if data.includeList is not None:
            update_data["includeList"] = data.includeList
        if data.isActive is not None:
            update_data["isActive"] = data.isActive

        # Recalculate next run time if schedule parameters changed
        if (data.frequency is not None or 
            data.frequencyDay is not None or 
            data.frequencyMonth is not None or 
            data.scheduledTime is not None):
            
            frequency = data.frequency or current_schedule.frequency
            frequency_day = data.frequencyDay if data.frequencyDay is not None else current_schedule.frequencyDay
            frequency_month = data.frequencyMonth if data.frequencyMonth is not None else current_schedule.frequencyMonth
            scheduled_time = data.scheduledTime or current_schedule.scheduledTime or '02:00'
            
            update_data["nextRunAt"] = calculate_next_run_at(
                frequency=frequency,
                frequency_day=frequency_day,
                frequency_month=frequency_month,
                scheduled_time=scheduled_time
            )

        # Update schedule
        schedule_raw = await prisma.automatedreportschedule.update(
            where={"id": schedule_id},
            data=update_data
        )

        schedule = AutomatedReportSchedule(
            id=schedule_raw.id,
            reportName=schedule_raw.reportName,
            reportType=schedule_raw.reportType,
            frequency=schedule_raw.frequency,
            frequencyDay=schedule_raw.frequencyDay,
            frequencyMonth=schedule_raw.frequencyMonth,
            scheduledTime=schedule_raw.scheduledTime,
            emailRecipients=schedule_raw.emailRecipients,
            filters=schedule_raw.filters,
            format=schedule_raw.format,
            includeList=schedule_raw.includeList,
            isActive=schedule_raw.isActive,
            lastSentAt=schedule_raw.lastSentAt,
            nextRunAt=schedule_raw.nextRunAt,
            createdBy=schedule_raw.createdBy,
            createdAt=schedule_raw.createdAt,
            updatedAt=schedule_raw.updatedAt,
        )

        return AutomatedReportScheduleResponse(schedule=schedule)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating automated report schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update automated report schedule")

@router.delete("/{schedule_id}", response_model=AutomatedReportScheduleDeleteResponse)
async def delete_automated_report(
    schedule_id: str = Path(..., description="Schedule ID"),
    auth: dict = Depends(verify_auth)
):
    """Delete an automated report schedule"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Check if schedule exists
        schedule = await prisma.automatedreportschedule.find_unique(
            where={"id": schedule_id}
        )

        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # Delete schedule
        await prisma.automatedreportschedule.delete(
            where={"id": schedule_id}
        )

        return AutomatedReportScheduleDeleteResponse(success=True)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting automated report schedule: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete automated report schedule")

