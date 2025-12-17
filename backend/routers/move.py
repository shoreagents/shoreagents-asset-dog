"""
Move API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime, timedelta
import logging

from models.move import MoveCreate, MoveResponse, MoveStatsResponse
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/move", tags=["move"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=MoveResponse, status_code=status.HTTP_201_CREATED)
async def create_move(
    move_data: MoveCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a move record for an asset"""
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

        if not move_data.assetId:
            raise HTTPException(status_code=400, detail="Asset ID is required")

        if not move_data.moveType:
            raise HTTPException(status_code=400, detail="Move type is required")

        if not move_data.moveDate:
            raise HTTPException(status_code=400, detail="Move date is required")

        # Validate move type specific requirements
        if move_data.moveType == 'Location Transfer' and not move_data.location:
            raise HTTPException(status_code=400, detail="Location is required for Location Transfer")

        if move_data.moveType == 'Employee Assignment' and not move_data.employeeUserId:
            raise HTTPException(status_code=400, detail="Employee user is required for Employee Assignment")

        if move_data.moveType == 'Department Transfer' and not move_data.department:
            raise HTTPException(status_code=400, detail="Department is required for Department Transfer")

        # Parse date
        move_date = parse_date(move_data.moveDate)

        # Create move record and update asset in a transaction
        async with prisma.tx() as transaction:
            # Get current asset to capture previous values
            asset = await transaction.assets.find_unique(
                where={"id": move_data.assetId}
            )

            if not asset:
                raise HTTPException(status_code=404, detail=f"Asset with ID {move_data.assetId} not found")

            # Check if asset is currently leased
            # Note: Prisma Python requires datetime objects, not date objects, even for Date fields
            active_lease = await transaction.assetslease.find_first(
                where={
                    "assetId": move_data.assetId,
                    "OR": [
                        {"leaseEndDate": None},
                        {"leaseEndDate": {"gte": move_date}}
                    ]
                }
            )

            if active_lease:
                raise HTTPException(
                    status_code=400,
                    detail=f"Asset cannot be moved. It is currently leased to {active_lease.lessee}"
                )

            # Prepare asset update data based on move type
            asset_update_data: Dict[str, Any] = {}
            history_logs = []

            if move_data.moveType == 'Location Transfer':
                old_location = asset.location or ''
                new_location = move_data.location or None
                if old_location != new_location:
                    asset_update_data["location"] = new_location
                    history_logs.append({
                        "field": "location",
                        "changeFrom": old_location,
                        "changeTo": new_location or ""
                    })
            elif move_data.moveType == 'Department Transfer':
                old_department = asset.department or ''
                new_department = move_data.department or None
                if old_department != new_department:
                    asset_update_data["department"] = new_department
                    history_logs.append({
                        "field": "department",
                        "changeFrom": old_department,
                        "changeTo": new_department or ""
                    })

            # For Employee Assignment, update the active checkout record
            if move_data.moveType == 'Employee Assignment' and move_data.employeeUserId:
                # Find the active checkout (one without checkins)
                active_checkouts = await transaction.assetscheckout.find_many(
                    where={
                        "assetId": move_data.assetId
                    },
                    include={
                        "checkins": True,
                        "employeeUser": True
                    },
                    order={"checkoutDate": "desc"}
                )

                # Filter to find checkout without checkins
                active_checkout = None
                for checkout in active_checkouts:
                    if not checkout.checkins or len(checkout.checkins) == 0:
                        active_checkout = checkout
                        break

                old_employee_user_id = active_checkout.employeeUserId if active_checkout else None

                if active_checkout:
                    # Update existing checkout to reassign to new employee
                    # Note: Prisma Python requires datetime objects, not date objects, even for Date fields
                    await transaction.assetscheckout.update(
                        where={"id": active_checkout.id},
                        data={
                            "employeeUserId": move_data.employeeUserId,
                            "checkoutDate": move_date
                        }
                    )

                    # Log assignedEmployee change if employee changed
                    if old_employee_user_id != move_data.employeeUserId:
                        try:
                            old_employee = await transaction.employeeuser.find_unique(
                                where={"id": old_employee_user_id}
                            ) if old_employee_user_id else None
                            new_employee = await transaction.employeeuser.find_unique(
                                where={"id": move_data.employeeUserId}
                            )

                            old_employee_name = old_employee.name if old_employee else ''
                            new_employee_name = new_employee.name if new_employee else ''

                            history_logs.append({
                                "field": "assignedEmployee",
                                "changeFrom": old_employee_name,
                                "changeTo": new_employee_name
                            })
                        except Exception as e:
                            logger.error(f"Error fetching employees for history log: {e}")
                            history_logs.append({
                                "field": "assignedEmployee",
                                "changeFrom": old_employee_user_id or "",
                                "changeTo": move_data.employeeUserId or ""
                            })
                else:
                    # No active checkout, create a new one
                    # Note: Prisma Python requires datetime objects, not date objects, even for Date fields
                    await transaction.assetscheckout.create(
                        data={
                            "assetId": move_data.assetId,
                            "employeeUserId": move_data.employeeUserId,
                            "checkoutDate": move_date
                        }
                    )
                    # Update asset status to "Checked out"
                    asset_update_data["status"] = "Checked out"
                    history_logs.append({
                        "field": "status",
                        "changeFrom": asset.status or "",
                        "changeTo": "Checked out"
                    })

                    # Log initial employee assignment
                    try:
                        new_employee = await transaction.employeeuser.find_unique(
                            where={"id": move_data.employeeUserId}
                        )
                        new_employee_name = new_employee.name if new_employee else ''
                        
                        history_logs.append({
                            "field": "assignedEmployee",
                            "changeFrom": "",
                            "changeTo": new_employee_name
                        })
                    except Exception as e:
                        logger.error(f"Error fetching employee for initial assignment log: {e}")
                        history_logs.append({
                            "field": "assignedEmployee",
                            "changeFrom": "",
                            "changeTo": move_data.employeeUserId or ""
                        })

            # Update asset if there are changes
            if asset_update_data:
                await transaction.assets.update(
                    where={"id": move_data.assetId},
                    data=asset_update_data
                )

            # Create history logs for each changed field
            if history_logs:
                for log in history_logs:
                    await transaction.assetshistorylogs.create(
                        data={
                            "assetId": move_data.assetId,
                            "eventType": "edited",
                            "field": log["field"],
                            "changeFrom": log["changeFrom"],
                            "changeTo": log["changeTo"],
                            "actionBy": userName,
                            "eventDate": move_date
                        }
                    )

            # Create move record (history tracking)
            # Note: Prisma Python requires datetime objects, not date objects, even for Date fields
            move = await transaction.assetsmove.create(
                data={
                    "assetId": move_data.assetId,
                    "moveType": move_data.moveType,
                    "moveDate": move_date,
                    "employeeUserId": move_data.employeeUserId if move_data.moveType == 'Employee Assignment' else None,
                    "reason": move_data.reason,
                    "notes": move_data.notes
                },
                include={
                    "asset": True,
                    "employeeUser": True
                }
            )

            move_dict = {
                "id": str(move.id),
                "assetId": str(move.assetId),
                "moveType": move.moveType,
                "moveDate": move.moveDate.isoformat() if hasattr(move.moveDate, 'isoformat') else str(move.moveDate),
                "employeeUserId": str(move.employeeUserId) if move.employeeUserId else None,
                "reason": move.reason,
                "notes": move.notes,
                "createdAt": move.createdAt.isoformat() if hasattr(move.createdAt, 'isoformat') else str(move.createdAt),
                "asset": {
                    "id": str(move.asset.id),
                    "assetTagId": str(move.asset.assetTagId),
                    "description": str(move.asset.description)
                } if move.asset else None,
                "employeeUser": {
                    "id": str(move.employeeUser.id),
                    "name": str(move.employeeUser.name),
                    "email": str(move.employeeUser.email)
                } if move.employeeUser else None
            }

            return MoveResponse(
                success=True,
                move=move_dict
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating move: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to move asset: {str(e)}")

@router.get("/stats", response_model=MoveStatsResponse)
async def get_move_stats(
    auth: dict = Depends(verify_auth)
):
    """Get move statistics"""
    try:
        # Get today's date range
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)

        # Count moves made today (based on createdAt, when the move was actually recorded)
        moved_today_count = await prisma.assetsmove.count(
            where={
                "createdAt": {
                    "gte": today,
                    "lt": tomorrow
                }
            }
        )

        # Get recent move history (last 10 moves)
        recent_moves_data = await prisma.assetsmove.find_many(
            take=10,
            include={
                "asset": True,
                "employeeUser": True
            },
            order={"createdAt": "desc"}
        )

        # Format the response
        recent_moves = []
        for move in recent_moves_data:
            move_dict = {
                "id": str(move.id),
                "assetId": str(move.assetId),
                "moveType": move.moveType,
                "moveDate": move.moveDate.isoformat() if hasattr(move.moveDate, 'isoformat') else str(move.moveDate),
                "employeeUserId": str(move.employeeUserId) if move.employeeUserId else None,
                "reason": move.reason,
                "notes": move.notes,
                "createdAt": move.createdAt.isoformat() if hasattr(move.createdAt, 'isoformat') else str(move.createdAt),
                "asset": {
                    "id": str(move.asset.id),
                    "assetTagId": str(move.asset.assetTagId),
                    "description": str(move.asset.description)
                } if move.asset else None,
                "employeeUser": {
                    "id": str(move.employeeUser.id),
                    "name": str(move.employeeUser.name),
                    "email": str(move.employeeUser.email)
                } if move.employeeUser else None
            }
            recent_moves.append(move_dict)

        return MoveStatsResponse(
            movedTodayCount=moved_today_count,
            recentMoves=recent_moves
        )

    except Exception as e:
        logger.error(f"Error fetching move statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch move statistics")

