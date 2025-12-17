"""
Checkout API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
import logging

from models.checkout import CheckoutCreate, CheckoutResponse, CheckoutStatsResponse, AssetUpdateInfo
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/checkout", tags=["checkout"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout(
    checkout_data: CheckoutCreate,
    auth: dict = Depends(verify_auth)
):
    """Create checkout records for assets"""
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

        if not checkout_data.assetIds or len(checkout_data.assetIds) == 0:
            raise HTTPException(status_code=400, detail="Asset IDs are required")

        if not checkout_data.employeeUserId:
            raise HTTPException(status_code=400, detail="Employee user ID is required")

        if not checkout_data.checkoutDate:
            raise HTTPException(status_code=400, detail="Checkout date is required")

        # Parse dates
        checkout_date = parse_date(checkout_data.checkoutDate)
        expected_return_date = None
        if checkout_data.expectedReturnDate:
            expected_return_date = parse_date(checkout_data.expectedReturnDate)

        # Create checkout records and update assets in a transaction
        checkout_records = []
        
        # Use Prisma transaction
        async with prisma.tx() as transaction:
            for asset_id in checkout_data.assetIds:
                asset_update = checkout_data.updates.get(asset_id) if checkout_data.updates else None
                
                # Get current asset
                current_asset = await transaction.assets.find_unique(
                    where={"id": asset_id}
                )

                if not current_asset:
                    raise HTTPException(status_code=404, detail=f"Asset with ID {asset_id} not found")

                # Prepare history logs
                history_logs = []

                # Prepare asset update data
                update_data: Dict[str, Any] = {
                    "status": "Checked out"
                }

                # Log status change if different
                if current_asset.status != "Checked out":
                    history_logs.append({
                        "field": "status",
                        "changeFrom": current_asset.status or "",
                        "changeTo": "Checked out"
                    })

                # Update department/site/location if provided
                new_department = asset_update.department if asset_update and asset_update.department is not None else current_asset.department
                new_site = asset_update.site if asset_update and asset_update.site is not None else current_asset.site
                new_location = asset_update.location if asset_update and asset_update.location is not None else current_asset.location

                update_data["department"] = new_department
                update_data["site"] = new_site
                update_data["location"] = new_location

                # Log location changes
                if new_location != current_asset.location:
                    history_logs.append({
                        "field": "location",
                        "changeFrom": current_asset.location or "",
                        "changeTo": new_location or ""
                    })

                # Log department changes
                if new_department != current_asset.department:
                    history_logs.append({
                        "field": "department",
                        "changeFrom": current_asset.department or "",
                        "changeTo": new_department or ""
                    })

                # Log site changes
                if new_site != current_asset.site:
                    history_logs.append({
                        "field": "site",
                        "changeFrom": current_asset.site or "",
                        "changeTo": new_site or ""
                    })

                # Update asset
                await transaction.assets.update(
                    where={"id": asset_id},
                    data=update_data
                )

                # Log assignedEmployee change
                if checkout_data.employeeUserId:
                    try:
                        employee = await transaction.employeeuser.find_unique(
                            where={"id": checkout_data.employeeUserId}
                        )
                        employee_name = employee.name if employee else checkout_data.employeeUserId
                        
                        history_logs.append({
                            "field": "assignedEmployee",
                            "changeFrom": "",
                            "changeTo": employee_name
                        })
                    except Exception as e:
                        logger.error(f"Error fetching employee for history log: {e}")
                        history_logs.append({
                            "field": "assignedEmployee",
                            "changeFrom": "",
                            "changeTo": checkout_data.employeeUserId
                        })

                # Create history logs
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
                                "eventDate": checkout_date
                            }
                        )

                # Create checkout record
                # Note: Prisma Python requires datetime objects, not date objects, even for Date fields
                checkout = await transaction.assetscheckout.create(
                    data={
                        "assetId": asset_id,
                        "employeeUserId": checkout_data.employeeUserId,
                        "checkoutDate": checkout_date,
                        "expectedReturnDate": expected_return_date
                    },
                    include={
                        "asset": True,
                        "employeeUser": True
                    }
                )

                checkout_records.append({
                    "id": str(checkout.id),
                    "assetId": str(checkout.assetId),
                    "employeeUserId": str(checkout.employeeUserId) if checkout.employeeUserId else None,
                    "checkoutDate": checkout.checkoutDate.isoformat() if hasattr(checkout.checkoutDate, 'isoformat') else str(checkout.checkoutDate),
                    "expectedReturnDate": checkout.expectedReturnDate.isoformat() if checkout.expectedReturnDate and hasattr(checkout.expectedReturnDate, 'isoformat') else (str(checkout.expectedReturnDate) if checkout.expectedReturnDate else None),
                    "asset": {
                        "id": str(checkout.asset.id),
                        "assetTagId": str(checkout.asset.assetTagId),
                        "description": str(checkout.asset.description)
                    } if checkout.asset else None,
                    "employeeUser": {
                        "id": str(checkout.employeeUser.id),
                        "name": str(checkout.employeeUser.name),
                        "email": str(checkout.employeeUser.email)
                    } if checkout.employeeUser else None
                })

        return CheckoutResponse(
            success=True,
            checkouts=checkout_records,
            count=len(checkout_records)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating checkout: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to checkout assets: {str(e)}")

@router.get("/stats", response_model=CheckoutStatsResponse)
async def get_checkout_stats(
    auth: dict = Depends(verify_auth)
):
    """Get recent checkout statistics"""
    try:
        # Get recent checkout history (last 5 checkouts)
        recent_checkouts_data = await prisma.assetscheckout.find_many(
            take=5,
            include={
                "asset": True,
                "employeeUser": True
            },
            order={"createdAt": "desc"}
        )

        # Format the response
        recent_checkouts = []
        for checkout in recent_checkouts_data:
            checkout_dict = {
                "id": str(checkout.id),
                "checkoutDate": checkout.checkoutDate.isoformat() if hasattr(checkout.checkoutDate, 'isoformat') else str(checkout.checkoutDate),
                "expectedReturnDate": checkout.expectedReturnDate.isoformat() if checkout.expectedReturnDate and hasattr(checkout.expectedReturnDate, 'isoformat') else (str(checkout.expectedReturnDate) if checkout.expectedReturnDate else None),
                "createdAt": checkout.createdAt.isoformat() if hasattr(checkout.createdAt, 'isoformat') else str(checkout.createdAt),
                "asset": {
                    "id": str(checkout.asset.id),
                    "assetTagId": str(checkout.asset.assetTagId),
                    "description": str(checkout.asset.description)
                } if checkout.asset else None,
                "employeeUser": {
                    "id": str(checkout.employeeUser.id),
                    "name": str(checkout.employeeUser.name),
                    "email": str(checkout.employeeUser.email)
                } if checkout.employeeUser else None
            }
            recent_checkouts.append(checkout_dict)

        return CheckoutStatsResponse(recentCheckouts=recent_checkouts)

    except Exception as e:
        logger.error(f"Error fetching checkout statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch checkout statistics")

