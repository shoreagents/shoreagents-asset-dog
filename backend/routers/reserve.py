"""
Reserve API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
import logging

from models.reserve import ReserveCreate, ReserveResponse, ReserveStatsResponse
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/reserve", tags=["reserve"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=ReserveResponse, status_code=status.HTTP_201_CREATED)
async def create_reserve(
    reserve_data: ReserveCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a reservation for an asset"""
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

        if not reserve_data.assetId:
            raise HTTPException(status_code=400, detail="Asset ID is required")

        if not reserve_data.reservationType:
            raise HTTPException(status_code=400, detail="Reservation type is required")

        if not reserve_data.reservationDate:
            raise HTTPException(status_code=400, detail="Reservation date is required")

        # Validate reservation type specific requirements
        if reserve_data.reservationType == 'Employee' and not reserve_data.employeeUserId:
            raise HTTPException(status_code=400, detail="Employee user is required for Employee reservation")

        if reserve_data.reservationType == 'Department' and not reserve_data.department:
            raise HTTPException(status_code=400, detail="Department is required for Department reservation")

        # Parse date
        reservation_date = parse_date(reserve_data.reservationDate)

        # Create reservation record in a transaction
        async with prisma.tx() as transaction:
            # Verify asset exists
            asset = await transaction.assets.find_unique(
                where={"id": reserve_data.assetId}
            )

            if not asset:
                raise HTTPException(status_code=404, detail=f"Asset with ID {reserve_data.assetId} not found")

            # Prepare history logs
            history_logs = []

            # Update asset status to "Reserved" if not already reserved
            if asset.status != "Reserved":
                await transaction.assets.update(
                    where={"id": reserve_data.assetId},
                    data={"status": "Reserved"}
                )

                # Log status change
                history_logs.append({
                    "field": "status",
                    "changeFrom": asset.status or "",
                    "changeTo": "Reserved"
                })

            # Create reservation record
            reservation = await transaction.assetsreserve.create(
                data={
                    "assetId": reserve_data.assetId,
                    "reservationType": reserve_data.reservationType,
                    "reservationDate": reservation_date,
                    "employeeUserId": reserve_data.employeeUserId,
                    "department": reserve_data.department,
                    "purpose": reserve_data.purpose,
                    "notes": reserve_data.notes
                },
                include={
                    "asset": True,
                    "employeeUser": True
                }
            )

            # Create history log entries
            if history_logs:
                for log_entry in history_logs:
                    await transaction.assethistory.create(
                        data={
                            "assetId": reserve_data.assetId,
                            "field": log_entry["field"],
                            "changeFrom": log_entry["changeFrom"],
                            "changeTo": log_entry["changeTo"],
                            "changedBy": userName,
                            "eventDate": reservation_date
                        }
                    )

            # Format response
            reservation_dict = {
                "id": str(reservation.id),
                "assetId": str(reservation.assetId),
                "reservationType": reservation.reservationType,
                "reservationDate": reservation.reservationDate.isoformat() if hasattr(reservation.reservationDate, 'isoformat') else str(reservation.reservationDate),
                "employeeUserId": str(reservation.employeeUserId) if reservation.employeeUserId else None,
                "department": reservation.department,
                "purpose": reservation.purpose,
                "notes": reservation.notes,
                "createdAt": reservation.createdAt.isoformat() if hasattr(reservation.createdAt, 'isoformat') else str(reservation.createdAt),
                "asset": {
                    "id": str(reservation.asset.id),
                    "assetTagId": str(reservation.asset.assetTagId),
                    "description": str(reservation.asset.description)
                } if reservation.asset else None,
                "employeeUser": {
                    "id": str(reservation.employeeUser.id),
                    "name": str(reservation.employeeUser.name),
                    "email": str(reservation.employeeUser.email)
                } if reservation.employeeUser else None
            }

            return ReserveResponse(
                success=True,
                reservation=reservation_dict
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating reservation: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create reservation: {str(e)}")

@router.get("/stats", response_model=ReserveStatsResponse)
async def get_reserve_stats(
    auth: dict = Depends(verify_auth)
):
    """Get reservation statistics"""
    try:
        # Count total reserved assets
        total_reserved = await prisma.assetsreserve.count()

        # Get recent reservation history (last 10 reservations)
        recent_reservations_data = await prisma.assetsreserve.find_many(
            take=10,
            include={
                "asset": True,
                "employeeUser": True
            },
            order={"createdAt": "desc"}
        )

        # Format the response
        recent_reservations = []
        for reservation in recent_reservations_data:
            reservation_dict = {
                "id": str(reservation.id),
                "reservationType": reservation.reservationType,
                "reservationDate": reservation.reservationDate.isoformat() if hasattr(reservation.reservationDate, 'isoformat') else str(reservation.reservationDate),
                "purpose": reservation.purpose,
                "createdAt": reservation.createdAt.isoformat() if hasattr(reservation.createdAt, 'isoformat') else str(reservation.createdAt),
                "asset": {
                    "id": str(reservation.asset.id),
                    "assetTagId": str(reservation.asset.assetTagId),
                    "description": str(reservation.asset.description)
                } if reservation.asset else None,
                "employeeUser": {
                    "id": str(reservation.employeeUser.id),
                    "name": str(reservation.employeeUser.name),
                    "email": str(reservation.employeeUser.email)
                } if reservation.employeeUser else None,
                "department": reservation.department
            }
            recent_reservations.append(reservation_dict)

        return ReserveStatsResponse(
            totalReserved=total_reserved,
            recentReservations=recent_reservations
        )

    except Exception as e:
        logger.error(f"Error fetching reservation statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch reservation statistics")

