"""
Lease Return API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
import logging

from models.lease_return import LeaseReturnCreate, LeaseReturnResponse, LeaseReturnStatsResponse, LeaseReturnAssetUpdate
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/lease-return", tags=["lease-return"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=LeaseReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_lease_return(
    return_data: LeaseReturnCreate,
    auth: dict = Depends(verify_auth)
):
    """Create lease return records for assets"""
    try:
        if not return_data.assetIds or len(return_data.assetIds) == 0:
            raise HTTPException(status_code=400, detail="Asset IDs are required")

        if not return_data.returnDate:
            raise HTTPException(status_code=400, detail="Return date is required")

        # Parse date
        return_date = parse_date(return_data.returnDate)

        # Process lease returns in a transaction
        return_records = []
        
        async with prisma.tx() as transaction:
            for asset_id in return_data.assetIds:
                # Find the most recent active lease for this asset
                active_lease = await transaction.assetslease.find_first(
                    where={
                        "assetId": asset_id,
                        "OR": [
                            {"leaseEndDate": None},
                            {"leaseEndDate": {"gte": return_date}}
                        ]
                    },
                    order={"leaseStartDate": "desc"}
                )

                if not active_lease:
                    raise HTTPException(
                        status_code=404,
                        detail=f"No active lease found for asset {asset_id}"
                    )

                # Check if this lease has already been returned
                existing_return = await transaction.assetsleasereturn.find_first(
                    where={"leaseId": active_lease.id}
                )

                if existing_return:
                    raise HTTPException(
                        status_code=400,
                        detail=f"This lease has already been returned"
                    )

                # Get update data for this asset (condition, notes)
                asset_update = return_data.updates.get(asset_id) if return_data.updates else None

                # Create lease return record
                lease_return = await transaction.assetsleasereturn.create(
                    data={
                        "assetId": asset_id,
                        "leaseId": active_lease.id,
                        "returnDate": return_date,
                        "condition": asset_update.condition if asset_update and asset_update.condition else None,
                        "notes": asset_update.notes if asset_update and asset_update.notes else None
                    },
                    include={
                        "asset": True,
                        "lease": True
                    }
                )

                # Update asset status back to Available
                await transaction.assets.update(
                    where={"id": asset_id},
                    data={"status": "Available"}
                )

                # Format response
                return_dict = {
                    "id": str(lease_return.id),
                    "assetId": str(lease_return.assetId),
                    "leaseId": str(lease_return.leaseId),
                    "returnDate": lease_return.returnDate.isoformat() if hasattr(lease_return.returnDate, 'isoformat') else str(lease_return.returnDate),
                    "condition": lease_return.condition,
                    "notes": lease_return.notes,
                    "createdAt": lease_return.createdAt.isoformat() if hasattr(lease_return.createdAt, 'isoformat') else str(lease_return.createdAt),
                    "asset": {
                        "id": str(lease_return.asset.id),
                        "assetTagId": str(lease_return.asset.assetTagId),
                        "description": str(lease_return.asset.description)
                    } if lease_return.asset else None,
                    "lease": {
                        "id": str(lease_return.lease.id),
                        "lessee": lease_return.lease.lessee,
                        "leaseStartDate": lease_return.lease.leaseStartDate.isoformat() if hasattr(lease_return.lease.leaseStartDate, 'isoformat') else str(lease_return.lease.leaseStartDate)
                    } if lease_return.lease else None
                }
                return_records.append(return_dict)

        return LeaseReturnResponse(
            success=True,
            returns=return_records,
            count=len(return_records)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lease return: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to return leased assets: {str(e)}")

@router.get("/stats", response_model=LeaseReturnStatsResponse)
async def get_lease_return_stats(
    auth: dict = Depends(verify_auth)
):
    """Get lease return statistics"""
    try:
        # Count total returned assets
        total_returned = await prisma.assetsleasereturn.count()

        # Get recent lease return history (last 10 returns)
        recent_returns_data = await prisma.assetsleasereturn.find_many(
            take=10,
            include={
                "asset": True,
                "lease": True
            },
            order={"createdAt": "desc"}
        )

        # Format the response
        recent_returns = []
        for return_record in recent_returns_data:
            return_dict = {
                "id": str(return_record.id),
                "returnDate": return_record.returnDate.isoformat() if hasattr(return_record.returnDate, 'isoformat') else str(return_record.returnDate),
                "condition": return_record.condition,
                "createdAt": return_record.createdAt.isoformat() if hasattr(return_record.createdAt, 'isoformat') else str(return_record.createdAt),
                "asset": {
                    "id": str(return_record.asset.id),
                    "assetTagId": str(return_record.asset.assetTagId),
                    "description": str(return_record.asset.description)
                } if return_record.asset else None,
                "lease": {
                    "id": str(return_record.lease.id),
                    "lessee": return_record.lease.lessee,
                    "leaseStartDate": return_record.lease.leaseStartDate.isoformat() if hasattr(return_record.lease.leaseStartDate, 'isoformat') else str(return_record.lease.leaseStartDate)
                } if return_record.lease else None
            }
            recent_returns.append(return_dict)

        return LeaseReturnStatsResponse(
            totalReturned=total_returned,
            recentReturns=recent_returns
        )

    except Exception as e:
        logger.error(f"Error fetching lease return statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch lease return statistics")

