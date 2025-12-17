"""
Dispose API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
from decimal import Decimal
import logging

from models.dispose import DisposeCreate, DisposeResponse, DisposeStatsResponse, DisposeAssetUpdate
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/dispose", tags=["dispose"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=DisposeResponse, status_code=status.HTTP_201_CREATED)
async def create_dispose(
    dispose_data: DisposeCreate,
    auth: dict = Depends(verify_auth)
):
    """Create disposal records for assets"""
    try:
        if not dispose_data.assetIds or len(dispose_data.assetIds) == 0:
            raise HTTPException(status_code=400, detail="Asset IDs are required")

        if not dispose_data.disposeDate:
            raise HTTPException(status_code=400, detail="Dispose date is required")

        if not dispose_data.disposeReason:
            raise HTTPException(status_code=400, detail="Disposal method is required")

        # Validate dispose value if method is "Sold"
        if dispose_data.disposeReason == 'Sold':
            has_common_value = dispose_data.disposeValue and dispose_data.disposeValue > 0
            has_per_asset_values = dispose_data.updates and any(
                update.disposeValue and update.disposeValue > 0
                for update in dispose_data.updates.values()
            )
            
            if not has_common_value and not has_per_asset_values:
                raise HTTPException(status_code=400, detail="Dispose value is required for Sold assets")

        # Parse date
        dispose_date = parse_date(dispose_data.disposeDate)

        # Process disposals in a transaction
        disposal_records = []
        
        async with prisma.tx() as transaction:
            for asset_id in dispose_data.assetIds:
                # Check if asset exists and is not already disposed
                asset = await transaction.assets.find_unique(
                    where={"id": asset_id},
                    include={
                        "checkouts": {
                            "where": {
                                "checkins": {
                                    "none": {}
                                }
                            },
                            "include": {
                                "employeeUser": True
                            }
                        }
                    }
                )

                if not asset:
                    raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")

                if asset.status == 'Disposed':
                    raise HTTPException(status_code=400, detail=f"Asset {asset_id} is already disposed")

                # Get update data for this asset
                asset_update = dispose_data.updates.get(asset_id) if dispose_data.updates else None
                dispose_value_for_asset = asset_update.disposeValue if asset_update and asset_update.disposeValue else dispose_data.disposeValue

                # End any active checkouts by creating checkin records
                for active_checkout in asset.checkouts:
                    if active_checkout.employeeUserId:
                        # Create checkin record to close the checkout
                        await transaction.assetscheckin.create(
                            data={
                                "assetId": asset_id,
                                "checkoutId": active_checkout.id,
                                "employeeUserId": active_checkout.employeeUserId,
                                "checkinDate": dispose_date,
                                "condition": None,
                                "notes": f"Asset disposed ({dispose_data.disposeReason})"
                            }
                        )

                # Create disposal record
                disposal = await transaction.assetsdispose.create(
                    data={
                        "assetId": asset_id,
                        "disposeDate": dispose_date,
                        "disposalMethod": dispose_data.disposeReason,
                        "disposeReason": dispose_data.disposeReasonText,
                        "disposeValue": Decimal(str(dispose_value_for_asset)) if dispose_data.disposeReason == 'Sold' and dispose_value_for_asset else None,
                        "notes": asset_update.notes if asset_update and asset_update.notes else None
                    },
                    include={
                        "asset": True
                    }
                )

                # Update asset status to the disposal method
                await transaction.assets.update(
                    where={"id": asset_id},
                    data={
                        "status": dispose_data.disposeReason,
                        "location": None,
                        "department": None,
                        "site": None
                    }
                )

                # Format response
                disposal_dict = {
                    "id": str(disposal.id),
                    "assetId": str(disposal.assetId),
                    "disposeDate": disposal.disposeDate.isoformat() if hasattr(disposal.disposeDate, 'isoformat') else str(disposal.disposeDate),
                    "disposalMethod": disposal.disposalMethod,
                    "disposeReason": disposal.disposeReason,
                    "disposeValue": float(disposal.disposeValue) if disposal.disposeValue else None,
                    "notes": disposal.notes,
                    "createdAt": disposal.createdAt.isoformat() if hasattr(disposal.createdAt, 'isoformat') else str(disposal.createdAt),
                    "asset": {
                        "id": str(disposal.asset.id),
                        "assetTagId": str(disposal.asset.assetTagId),
                        "description": str(disposal.asset.description)
                    } if disposal.asset else None
                }
                disposal_records.append(disposal_dict)

        return DisposeResponse(
            success=True,
            disposals=disposal_records,
            count=len(disposal_records)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating disposal: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to dispose assets: {str(e)}")

@router.get("/stats", response_model=DisposeStatsResponse)
async def get_dispose_stats(
    auth: dict = Depends(verify_auth)
):
    """Get disposal statistics"""
    try:
        # Count disposals created today
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = datetime(today.year, today.month, today.day + 1)
        
        disposed_today_count = await prisma.assetsdispose.count(
            where={
                "createdAt": {
                    "gte": today,
                    "lt": tomorrow
                }
            }
        )

        # Get recent disposals (last 10)
        recent_disposals_data = await prisma.assetsdispose.find_many(
            take=10,
            include={
                "asset": {
                    "include": {
                        "category": True,
                        "subCategory": True
                    }
                }
            },
            order={"createdAt": "desc"}
        )

        # Format the response
        recent_disposals = []
        for disposal in recent_disposals_data:
            disposal_dict = {
                "id": str(disposal.id),
                "disposeDate": disposal.disposeDate.isoformat() if hasattr(disposal.disposeDate, 'isoformat') else str(disposal.disposeDate),
                "disposalMethod": disposal.disposalMethod,
                "disposeReason": disposal.disposeReason,
                "disposeValue": float(disposal.disposeValue) if disposal.disposeValue else None,
                "notes": disposal.notes,
                "createdAt": disposal.createdAt.isoformat() if hasattr(disposal.createdAt, 'isoformat') else str(disposal.createdAt),
                "asset": {
                    "id": str(disposal.asset.id),
                    "assetTagId": str(disposal.asset.assetTagId),
                    "description": str(disposal.asset.description),
                    "category": {
                        "id": str(disposal.asset.category.id),
                        "name": str(disposal.asset.category.name)
                    } if disposal.asset.category else None,
                    "subCategory": {
                        "id": str(disposal.asset.subCategory.id),
                        "name": str(disposal.asset.subCategory.name)
                    } if disposal.asset.subCategory else None
                } if disposal.asset else None
            }
            recent_disposals.append(disposal_dict)

        return DisposeStatsResponse(
            disposedTodayCount=disposed_today_count,
            recentDisposals=recent_disposals
        )

    except Exception as e:
        logger.error(f"Error fetching disposal statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch disposal statistics")

