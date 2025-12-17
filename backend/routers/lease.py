"""
Lease API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
import logging

from models.lease import LeaseCreate, LeaseResponse, LeaseStatsResponse
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/lease", tags=["lease"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=LeaseResponse, status_code=status.HTTP_201_CREATED)
async def create_lease(
    lease_data: LeaseCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a lease for an asset"""
    try:
        if not lease_data.assetId:
            raise HTTPException(status_code=400, detail="Asset ID is required")

        if not lease_data.lessee or not lease_data.lessee.strip():
            raise HTTPException(status_code=400, detail="Lessee (third party) is required")

        if not lease_data.leaseStartDate:
            raise HTTPException(status_code=400, detail="Lease start date is required")

        # Parse dates
        lease_start_date = parse_date(lease_data.leaseStartDate)
        lease_end_date = None
        if lease_data.leaseEndDate:
            lease_end_date = parse_date(lease_data.leaseEndDate)
            # Validate lease end date is after start date
            if lease_end_date < lease_start_date:
                raise HTTPException(status_code=400, detail="Lease end date must be after start date")

        # Create lease record in a transaction
        async with prisma.tx() as transaction:
            # Verify asset exists
            asset = await transaction.assets.find_unique(
                where={"id": lease_data.assetId}
            )

            if not asset:
                raise HTTPException(status_code=404, detail=f"Asset with ID {lease_data.assetId} not found")

            # Check if asset is available for lease (must be Available status)
            if asset.status and asset.status != "Available":
                raise HTTPException(
                    status_code=400,
                    detail=f"Asset is not available for lease. Current status: {asset.status}"
                )

            # Check if asset already has an active lease (not returned)
            active_lease = await transaction.assetslease.find_first(
                where={
                    "assetId": lease_data.assetId,
                    "returns": {
                        "none": {}  # Exclude leases that have been returned
                    },
                    "OR": [
                        {"leaseEndDate": None},
                        {"leaseEndDate": {"gte": lease_start_date}}
                    ]
                }
            )

            if active_lease:
                raise HTTPException(status_code=400, detail="Asset already has an active lease")

            # Create lease record
            lease = await transaction.assetslease.create(
                data={
                    "assetId": lease_data.assetId,
                    "lessee": lease_data.lessee.strip(),
                    "leaseStartDate": lease_start_date,
                    "leaseEndDate": lease_end_date,
                    "conditions": lease_data.conditions,
                    "notes": lease_data.notes
                },
                include={
                    "asset": True
                }
            )

            # Update asset status to "Leased"
            await transaction.assets.update(
                where={"id": lease_data.assetId},
                data={"status": "Leased"}
            )

            # Format response
            lease_dict = {
                "id": str(lease.id),
                "assetId": str(lease.assetId),
                "lessee": lease.lessee,
                "leaseStartDate": lease.leaseStartDate.isoformat() if hasattr(lease.leaseStartDate, 'isoformat') else str(lease.leaseStartDate),
                "leaseEndDate": lease.leaseEndDate.isoformat() if lease.leaseEndDate and hasattr(lease.leaseEndDate, 'isoformat') else (str(lease.leaseEndDate) if lease.leaseEndDate else None),
                "conditions": lease.conditions,
                "notes": lease.notes,
                "createdAt": lease.createdAt.isoformat() if hasattr(lease.createdAt, 'isoformat') else str(lease.createdAt),
                "asset": {
                    "id": str(lease.asset.id),
                    "assetTagId": str(lease.asset.assetTagId),
                    "description": str(lease.asset.description)
                } if lease.asset else None
            }

            return LeaseResponse(
                success=True,
                lease=lease_dict
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lease: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create lease: {str(e)}")

@router.get("/stats", response_model=LeaseStatsResponse)
async def get_lease_stats(
    auth: dict = Depends(verify_auth)
):
    """Get lease statistics"""
    try:
        # Count total leased assets (active leases where end date is in future or null)
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        total_leased = await prisma.assetslease.count(
            where={
                "OR": [
                    {"leaseEndDate": None},
                    {"leaseEndDate": {"gte": today}}
                ]
            }
        )

        # Get recent lease history (last 10 leases)
        recent_leases_data = await prisma.assetslease.find_many(
            take=10,
            include={
                "asset": True
            },
            order={"createdAt": "desc"}
        )

        # Format the response
        recent_leases = []
        for lease in recent_leases_data:
            lease_dict = {
                "id": str(lease.id),
                "lessee": lease.lessee,
                "leaseStartDate": lease.leaseStartDate.isoformat() if hasattr(lease.leaseStartDate, 'isoformat') else str(lease.leaseStartDate),
                "leaseEndDate": lease.leaseEndDate.isoformat() if lease.leaseEndDate and hasattr(lease.leaseEndDate, 'isoformat') else (str(lease.leaseEndDate) if lease.leaseEndDate else None),
                "conditions": lease.conditions,
                "createdAt": lease.createdAt.isoformat() if hasattr(lease.createdAt, 'isoformat') else str(lease.createdAt),
                "asset": {
                    "id": str(lease.asset.id),
                    "assetTagId": str(lease.asset.assetTagId),
                    "description": str(lease.asset.description)
                } if lease.asset else None
            }
            recent_leases.append(lease_dict)

        return LeaseStatsResponse(
            totalLeased=total_leased,
            recentLeases=recent_leases
        )

    except Exception as e:
        logger.error(f"Error fetching lease statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch lease statistics")

