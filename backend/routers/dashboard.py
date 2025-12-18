"""
Dashboard API router
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List
from datetime import datetime, timedelta
from decimal import Decimal
import logging

from models.dashboard import DashboardStatsResponse, AssetValueGroupedResponse, AssetValueGroupedItem
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

def format_date_only(date_obj) -> str:
    """Format datetime to date string"""
    if not date_obj:
        return None
    if hasattr(date_obj, 'isoformat'):
        return date_obj.isoformat().split('T')[0]
    return str(date_obj)

@router.get("/asset-value-grouped", response_model=AssetValueGroupedResponse)
async def get_asset_value_grouped(
    groupBy: str = Query(default="category", description="Group by: category, status, location, department, site"),
    auth: dict = Depends(verify_auth)
):
    """Get asset values grouped by category, status, location, department, or site"""
    try:
        result: List[AssetValueGroupedItem] = []
        
        if groupBy == 'category':
            assets_by_category_raw = await prisma.assets.group_by(
                by=["categoryId"],
                where={
                    "isDeleted": False,
                    "cost": {"not": None}
                },
                sum={"cost": True}
            )
            
            categories = await prisma.category.find_many(
                select={"id": True, "name": True}
            )
            
            category_map = {cat.id: cat.name for cat in categories}
            result = [
                AssetValueGroupedItem(
                    name=category_map.get(row['categoryId'], 'Uncategorized') if row.get('categoryId') else 'Uncategorized',
                    value=float(row['_sum']['cost']) if row.get('_sum') and row['_sum'].get('cost') else 0.0
                )
                for row in assets_by_category_raw
            ]
            # Sort by value descending
            result.sort(key=lambda x: x.value, reverse=True)
        
        elif groupBy == 'status':
            assets_by_status_raw = await prisma.assets.group_by(
                by=["status"],
                where={
                    "isDeleted": False,
                    "cost": {"not": None},
                    "status": {"not": None}
                },
                sum={"cost": True}
            )
            
            result = [
                AssetValueGroupedItem(
                    name=row.get('status') or 'Unknown',
                    value=float(row['_sum']['cost']) if row.get('_sum') and row['_sum'].get('cost') else 0.0
                )
                for row in assets_by_status_raw
                if row.get('status')
            ]
            # Sort by value descending
            result.sort(key=lambda x: x.value, reverse=True)
        
        elif groupBy == 'location':
            assets_by_location_raw = await prisma.assets.group_by(
                by=["location"],
                where={
                    "isDeleted": False,
                    "cost": {"not": None},
                    "location": {"not": None}
                },
                sum={"cost": True}
            )
            
            result = [
                AssetValueGroupedItem(
                    name=row.get('location') or 'Unknown',
                    value=float(row['_sum']['cost']) if row.get('_sum') and row['_sum'].get('cost') else 0.0
                )
                for row in assets_by_location_raw
                if row.get('location') and row.get('location', '').strip() != ''
            ]
            # Sort by value descending
            result.sort(key=lambda x: x.value, reverse=True)
        
        elif groupBy == 'department':
            assets_by_department_raw = await prisma.assets.group_by(
                by=["department"],
                where={
                    "isDeleted": False,
                    "cost": {"not": None},
                    "department": {"not": None}
                },
                sum={"cost": True}
            )
            
            result = [
                AssetValueGroupedItem(
                    name=row.get('department') or 'Unknown',
                    value=float(row['_sum']['cost']) if row.get('_sum') and row['_sum'].get('cost') else 0.0
                )
                for row in assets_by_department_raw
                if row.get('department') and row.get('department', '').strip() != ''
            ]
            # Sort by value descending
            result.sort(key=lambda x: x.value, reverse=True)
        
        elif groupBy == 'site':
            assets_by_site_raw = await prisma.assets.group_by(
                by=["site"],
                where={
                    "isDeleted": False,
                    "cost": {"not": None},
                    "site": {"not": None}
                },
                sum={"cost": True}
            )
            
            result = [
                AssetValueGroupedItem(
                    name=row.get('site') or 'Unknown',
                    value=float(row['_sum']['cost']) if row.get('_sum') and row['_sum'].get('cost') else 0.0
                )
                for row in assets_by_site_raw
                if row.get('site') and row.get('site', '').strip() != ''
            ]
            # Sort by value descending
            result.sort(key=lambda x: x.value, reverse=True)
        
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid groupBy parameter. Must be one of: category, status, location, department, site"
            )
        
        return AssetValueGroupedResponse(data=result)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching grouped asset values: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch grouped asset values")

@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    auth: dict = Depends(verify_auth)
):
    """Get dashboard statistics"""
    try:
        now = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        fiscal_year_start = datetime(now.year, 1, 1)
        fiscal_year_end = datetime(now.year + 1, 1, 1)
        expiring_threshold = now + timedelta(days=90)
        thirty_days_ago = now - timedelta(days=30)
        
        # Execute all queries in parallel using transaction
        async with prisma.tx() as transaction:
            # Get asset value by category
            assets_by_category_raw = await transaction.assets.group_by(
                by=["categoryId"],
                where={"isDeleted": False, "cost": {"not": None}},
                sum={"cost": True}
            )
            
            categories = await transaction.category.find_many()
            
            # Summary statistics
            total_active_assets = await transaction.assets.count(where={"isDeleted": False})
            # Prisma Python doesn't support aggregate on transactions, so fetch and sum manually
            assets_for_sum = await transaction.assets.find_many(
                where={"isDeleted": False, "cost": {"not": None}}
            )
            total_value = sum(
                float(asset.cost) if asset.cost is not None else 0.0
                for asset in assets_for_sum
            )
            checked_out_count = await transaction.assets.count(
                where={"isDeleted": False, "status": {"equals": "Checked out", "mode": "insensitive"}}
            )
            available_count = await transaction.assets.count(
                where={"isDeleted": False, "status": {"equals": "Available", "mode": "insensitive"}}
            )
            purchases_in_fiscal_year = await transaction.assets.count(
                where={
                    "isDeleted": False,
                    "OR": [
                        {"purchaseDate": {"gte": fiscal_year_start, "lt": fiscal_year_end}},
                        {"dateAcquired": {"gte": fiscal_year_start, "lt": fiscal_year_end}}
                    ]
                }
            )
            
            # Feed data
            total_active_checkouts = await transaction.assetscheckout.count(
                where={"checkins": {"none": {}}}
            )
            active_checkouts = await transaction.assetscheckout.find_many(
                where={"checkins": {"none": {}}},
                include={"asset": True, "employeeUser": True},
                order={"checkoutDate": "desc"},
                take=10
            )
            
            total_checkins = await transaction.assetscheckin.count()
            recent_checkins = await transaction.assetscheckin.find_many(
                include={"asset": True, "checkout": {"include": {"employeeUser": True}}},
                order={"checkinDate": "desc"},
                take=10
            )
            
            total_assets_under_repair = await transaction.assetsmaintenance.count(
                where={"status": {"in": ["Scheduled", "In progress"]}}
            )
            assets_under_repair = await transaction.assetsmaintenance.find_many(
                where={"status": {"in": ["Scheduled", "In progress"]}},
                include={"asset": True},
                order={"createdAt": "desc"},
                take=10
            )
            
            # Calendar data
            leases_expiring = await transaction.assetslease.find_many(
                where={
                    "leaseEndDate": {"gte": now, "lte": expiring_threshold},
                    "returns": {"none": {}}
                },
                include={"asset": True},
                order={"leaseEndDate": "asc"}
            )
            
            maintenance_due = await transaction.assetsmaintenance.find_many(
                where={
                    "status": {"in": ["Scheduled", "In progress"]},
                    "dueDate": {"not": None}
                },
                include={"asset": True},
                order={"dueDate": "asc"}
            )
            
            # Feed data - Move, Reserve, Lease, Return, Dispose
            total_moves = await transaction.assetsmove.count()
            recent_moves = await transaction.assetsmove.find_many(
                include={"asset": True, "employeeUser": True},
                order={"createdAt": "desc"},
                take=10
            )
            
            total_reserves = await transaction.assetsreserve.count()
            recent_reserves = await transaction.assetsreserve.find_many(
                include={"asset": True, "employeeUser": True},
                order={"createdAt": "desc"},
                take=10
            )
            
            total_leases = await transaction.assetslease.count()
            recent_leases = await transaction.assetslease.find_many(
                include={"asset": True},
                order={"createdAt": "desc"},
                take=10
            )
            
            total_returns = await transaction.assetsleasereturn.count()
            recent_returns = await transaction.assetsleasereturn.find_many(
                include={"asset": True, "lease": True},
                order={"createdAt": "desc"},
                take=10
            )
            
            total_disposes = await transaction.assetsdispose.count()
            recent_disposes = await transaction.assetsdispose.find_many(
                include={"asset": True},
                order={"createdAt": "desc"},
                take=10
            )
            
            total_new_assets = await transaction.assets.count(
                where={"isDeleted": False, "createdAt": {"gte": thirty_days_ago}}
            )
            recent_assets = await transaction.assets.find_many(
                where={"isDeleted": False, "createdAt": {"gte": thirty_days_ago}},
                order={"createdAt": "desc"},
                take=10
            )
        
        # Process asset value by category
        category_map = {cat.id: cat.name for cat in categories}
        asset_value_by_category = [
            AssetValueGroupedItem(
                name=category_map.get(row['categoryId'], 'Uncategorized') if row.get('categoryId') else 'Uncategorized',
                value=float(row['_sum']['cost']) if row.get('_sum') and row['_sum'].get('cost') else 0.0
            )
            for row in assets_by_category_raw
        ]
        # Sort by value descending
        asset_value_by_category.sort(key=lambda x: x.value, reverse=True)
        
        # Calculate derived values
        checked_out_and_available = checked_out_count + available_count
        # total_value is already calculated above
        
        # Format responses
        return DashboardStatsResponse(
            assetValueByCategory=asset_value_by_category,
            activeCheckouts=[
                {
                    "id": str(checkout.id),
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
                }
                for checkout in active_checkouts
            ],
            recentCheckins=[
                {
                    "id": str(checkin.id),
                    "checkinDate": checkin.checkinDate.isoformat() if hasattr(checkin.checkinDate, 'isoformat') else str(checkin.checkinDate),
                    "asset": {
                        "id": str(checkin.asset.id),
                        "assetTagId": str(checkin.asset.assetTagId),
                        "description": str(checkin.asset.description)
                    } if checkin.asset else None,
                    "checkout": {
                        "employeeUser": {
                            "id": str(checkin.checkout.employeeUser.id),
                            "name": str(checkin.checkout.employeeUser.name),
                            "email": str(checkin.checkout.employeeUser.email)
                        } if checkin.checkout.employeeUser else {"id": "", "name": "", "email": ""}
                    } if checkin.checkout else None
                }
                for checkin in recent_checkins
            ],
            assetsUnderRepair=[
                {
                    "id": str(maintenance.id),
                    "dueDate": format_date_only(maintenance.dueDate),
                    "status": maintenance.status,
                    "maintenanceBy": maintenance.maintenanceBy,
                    "asset": {
                        "id": str(maintenance.asset.id),
                        "assetTagId": str(maintenance.asset.assetTagId),
                        "description": str(maintenance.asset.description)
                    } if maintenance.asset else None
                }
                for maintenance in assets_under_repair
            ],
            recentMoves=[
                {
                    "id": str(move.id),
                    "moveDate": move.moveDate.isoformat() if hasattr(move.moveDate, 'isoformat') else str(move.moveDate),
                    "newLocation": move.moveType if hasattr(move, 'moveType') else None,
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
                for move in recent_moves
            ],
            recentReserves=[
                {
                    "id": str(reserve.id),
                    "reservationDate": reserve.reservationDate.isoformat() if hasattr(reserve.reservationDate, 'isoformat') else str(reserve.reservationDate),
                    "reservationType": reserve.reservationType,
                    "asset": {
                        "id": str(reserve.asset.id),
                        "assetTagId": str(reserve.asset.assetTagId),
                        "description": str(reserve.asset.description)
                    } if reserve.asset else None,
                    "employeeUser": {
                        "id": str(reserve.employeeUser.id),
                        "name": str(reserve.employeeUser.name),
                        "email": str(reserve.employeeUser.email)
                    } if reserve.employeeUser else None
                }
                for reserve in recent_reserves
            ],
            recentLeases=[
                {
                    "id": str(lease.id),
                    "leaseStartDate": lease.leaseStartDate.isoformat() if hasattr(lease.leaseStartDate, 'isoformat') else str(lease.leaseStartDate),
                    "leaseEndDate": format_date_only(lease.leaseEndDate),
                    "lessee": lease.lessee,
                    "asset": {
                        "id": str(lease.asset.id),
                        "assetTagId": str(lease.asset.assetTagId),
                        "description": str(lease.asset.description)
                    } if lease.asset else None
                }
                for lease in recent_leases
            ],
            recentReturns=[
                {
                    "id": str(return_item.id),
                    "returnDate": return_item.returnDate.isoformat() if hasattr(return_item.returnDate, 'isoformat') else str(return_item.returnDate),
                    "asset": {
                        "id": str(return_item.asset.id),
                        "assetTagId": str(return_item.asset.assetTagId),
                        "description": str(return_item.asset.description)
                    } if return_item.asset else None,
                    "lease": {
                        "id": str(return_item.lease.id),
                        "lessee": return_item.lease.lessee
                    } if return_item.lease else None
                }
                for return_item in recent_returns
            ],
            recentDisposes=[
                {
                    "id": str(dispose.id),
                    "disposeDate": dispose.disposeDate.isoformat() if hasattr(dispose.disposeDate, 'isoformat') else str(dispose.disposeDate),
                    "disposalMethod": dispose.disposalMethod,
                    "asset": {
                        "id": str(dispose.asset.id),
                        "assetTagId": str(dispose.asset.assetTagId),
                        "description": str(dispose.asset.description)
                    } if dispose.asset else None
                }
                for dispose in recent_disposes
            ],
            recentAssets=[
                {
                    "id": str(asset.id),
                    "createdAt": asset.createdAt.isoformat() if hasattr(asset.createdAt, 'isoformat') else str(asset.createdAt),
                    "issuedTo": asset.issuedTo,
                    "asset": {
                        "id": str(asset.id),
                        "assetTagId": str(asset.assetTagId),
                        "description": str(asset.description)
                    }
                }
                for asset in recent_assets
            ],
            feedCounts={
                "totalActiveCheckouts": total_active_checkouts,
                "totalCheckins": total_checkins,
                "totalAssetsUnderRepair": total_assets_under_repair,
                "totalMoves": total_moves,
                "totalReserves": total_reserves,
                "totalLeases": total_leases,
                "totalReturns": total_returns,
                "totalDisposes": total_disposes,
                "totalNewAssets": total_new_assets
            },
            summary={
                "totalActiveAssets": total_active_assets,
                "totalValue": total_value,
                "purchasesInFiscalYear": purchases_in_fiscal_year,
                "checkedOutCount": checked_out_count,
                "availableCount": available_count,
                "checkedOutAndAvailable": checked_out_and_available
            },
            calendar={
                "leasesExpiring": [
                    {
                        "id": str(lease.id),
                        "leaseEndDate": format_date_only(lease.leaseEndDate),
                        "lessee": lease.lessee,
                        "asset": {
                            "id": str(lease.asset.id),
                            "assetTagId": str(lease.asset.assetTagId),
                            "description": str(lease.asset.description)
                        } if lease.asset else None
                    }
                    for lease in leases_expiring
                ],
                "maintenanceDue": [
                    {
                        "id": str(maintenance.id),
                        "dueDate": format_date_only(maintenance.dueDate),
                        "title": maintenance.title,
                        "asset": {
                            "id": str(maintenance.asset.id),
                            "assetTagId": str(maintenance.asset.assetTagId),
                            "description": str(maintenance.asset.description)
                        } if maintenance.asset else None
                    }
                    for maintenance in maintenance_due
                ]
            }
        )
    
    except Exception as e:
        logger.error(f"Error fetching dashboard statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard statistics")

