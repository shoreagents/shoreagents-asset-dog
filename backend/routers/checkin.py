"""
Checkin API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
import logging

from models.checkin import CheckinCreate, CheckinResponse, CheckinStatsResponse, CheckinAssetUpdate
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/checkin", tags=["checkin"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
async def create_checkin(
    checkin_data: CheckinCreate,
    auth: dict = Depends(verify_auth)
):
    """Create checkin records for assets"""
    try:
        # Get user info for history logging
        user_metadata = auth.get('user', {}).get('user_metadata', {})
        userName = (
            user_metadata.get('name') or
            user_metadata.get('full_name') or
            auth.get('user', {}).get('email', '').split('@')[0] or
            auth.get('user', {}).get('email') or
            auth.get('user', {}).get('id', 'Unknown')
        )

        if not checkin_data.assetIds or len(checkin_data.assetIds) == 0:
            raise HTTPException(status_code=400, detail="Asset IDs are required")

        if not checkin_data.checkinDate:
            raise HTTPException(status_code=400, detail="Check-in date is required")

        # Parse date
        checkin_date = parse_date(checkin_data.checkinDate)

        # Create checkin records and update assets in a transaction
        checkin_records = []
        
        # Use Prisma transaction
        async with prisma.tx() as transaction:
            for asset_id in checkin_data.assetIds:
                asset_update = checkin_data.updates.get(asset_id) if checkin_data.updates else None
                
                # Get the asset and all its checkouts
                # Note: Prisma Python doesn't support 'order' inside 'include', so we'll sort in Python
                asset = await transaction.assets.find_unique(
                    where={"id": asset_id},
                    include={
                        "checkouts": {
                            "include": {
                                "checkins": True
                            }
                        }
                    }
                )

                if not asset:
                    raise HTTPException(status_code=404, detail=f"Asset with ID {asset_id} not found")

                if asset.status != "Checked out":
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Asset {asset.assetTagId} is not checked out. Current status: {asset.status}"
                    )

                # Get ALL active checkouts (those without checkins) that have employees assigned
                active_checkouts = [
                    checkout for checkout in asset.checkouts
                    if len(checkout.checkins) == 0 and checkout.employeeUserId is not None
                ]
                # Sort by checkoutDate descending (most recent first)
                # Note: Prisma Python doesn't support 'order' inside 'include', so we sort in Python
                active_checkouts.sort(key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min, reverse=True)

                if len(active_checkouts) == 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"No active checkout found for asset {asset.assetTagId}"
                    )

                # Use the most recent active checkout for history logging
                active_checkout = active_checkouts[0]

                # Prepare history logs
                history_logs = []

                # Log status change from "Checked out" to "Available"
                history_logs.append({
                    "field": "status",
                    "changeFrom": asset.status,
                    "changeTo": "Available"
                })

                # Log assignedEmployee clearing (employee assignment ends when checked in)
                if active_checkout.employeeUserId:
                    try:
                        employee = await transaction.employeeuser.find_unique(
                            where={"id": active_checkout.employeeUserId}
                        )
                        employee_name = employee.name if employee else active_checkout.employeeUserId
                        
                        history_logs.append({
                            "field": "assignedEmployee",
                            "changeFrom": employee_name,
                            "changeTo": ""
                        })
                    except Exception as e:
                        logger.error(f"Error fetching employee for checkin history log: {e}")
                        history_logs.append({
                            "field": "assignedEmployee",
                            "changeFrom": active_checkout.employeeUserId,
                            "changeTo": ""
                        })

                # Update asset status to Available and location if provided
                update_data: Dict[str, Any] = {
                    "status": "Available"
                }

                # Update location if return location is provided
                new_location = asset_update.returnLocation if asset_update and asset_update.returnLocation is not None else asset.location

                if asset_update and asset_update.returnLocation is not None:
                    update_data["location"] = new_location

                    # Log location change if different from current location
                    if str(asset.location or '') != str(new_location or ''):
                        history_logs.append({
                            "field": "location",
                            "changeFrom": asset.location or "",
                            "changeTo": new_location or ""
                        })

                # Update asset
                await transaction.assets.update(
                    where={"id": asset_id},
                    data=update_data
                )

                # Create history logs for each changed field
                if history_logs:
                    for log in history_logs:
                        await transaction.assetshistorylogs.create(
                            data={
                                "assetId": asset_id,
                                "eventType": "edited",
                                "field": log["field"],
                                "changeFrom": log["changeFrom"],
                                "changeTo": log["changeTo"],
                                "actionBy": userName,
                                "eventDate": checkin_date
                            }
                        )

                # Create checkin records for ALL active checkouts (not just one)
                # This ensures all active checkouts are marked as checked in
                for checkout in active_checkouts:
                    checkin = await transaction.assetscheckin.create(
                        data={
                            "assetId": asset_id,
                            "checkoutId": checkout.id,
                            "employeeUserId": checkout.employeeUserId,
                            # Note: Prisma Python requires datetime objects, not date objects, even for Date fields
                            "checkinDate": checkin_date,
                            "condition": asset_update.condition if asset_update and asset_update.condition else None,
                            "notes": asset_update.notes if asset_update and asset_update.notes else None,
                        },
                        include={
                            "asset": True,
                            "employeeUser": True,
                            "checkout": True
                        }
                    )

                    checkin_records.append({
                        "id": str(checkin.id),
                        "assetId": str(checkin.assetId),
                        "checkoutId": str(checkin.checkoutId),
                        "employeeUserId": str(checkin.employeeUserId) if checkin.employeeUserId else None,
                        "checkinDate": checkin.checkinDate.isoformat() if hasattr(checkin.checkinDate, 'isoformat') else str(checkin.checkinDate),
                        "condition": checkin.condition,
                        "notes": checkin.notes,
                        "asset": {
                            "id": str(checkin.asset.id),
                            "assetTagId": str(checkin.asset.assetTagId),
                            "description": str(checkin.asset.description)
                        } if checkin.asset else None,
                        "employeeUser": {
                            "id": str(checkin.employeeUser.id),
                            "name": str(checkin.employeeUser.name),
                            "email": str(checkin.employeeUser.email)
                        } if checkin.employeeUser else None
                    })

        return CheckinResponse(
            success=True,
            checkins=checkin_records,
            count=len(checkin_records)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating checkin: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check in assets: {str(e)}")

@router.get("/stats", response_model=CheckinStatsResponse)
async def get_checkin_stats(
    auth: dict = Depends(verify_auth)
):
    """Get recent checkin statistics"""
    try:
        # Get recent check-in history (last 10 check-ins)
        recent_checkins_data = await prisma.assetscheckin.find_many(
            take=10,
            include={
                "asset": True,
                "employeeUser": True
            },
            order={"createdAt": "desc"}
        )

        # Format the response
        recent_checkins = []
        for checkin in recent_checkins_data:
            checkin_dict = {
                "id": str(checkin.id),
                "checkinDate": checkin.checkinDate.isoformat() if hasattr(checkin.checkinDate, 'isoformat') else str(checkin.checkinDate),
                "condition": checkin.condition,
                "createdAt": checkin.createdAt.isoformat() if hasattr(checkin.createdAt, 'isoformat') else str(checkin.createdAt),
                "asset": {
                    "id": str(checkin.asset.id),
                    "assetTagId": str(checkin.asset.assetTagId),
                    "description": str(checkin.asset.description)
                } if checkin.asset else None,
                "employeeUser": {
                    "id": str(checkin.employeeUser.id),
                    "name": str(checkin.employeeUser.name),
                    "email": str(checkin.employeeUser.email),
                    "department": checkin.employeeUser.department if hasattr(checkin.employeeUser, 'department') else None
                } if checkin.employeeUser else None
            }
            recent_checkins.append(checkin_dict)

        return CheckinStatsResponse(recentCheckins=recent_checkins)

    except Exception as e:
        logger.error(f"Error fetching checkin statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch check-in statistics")

