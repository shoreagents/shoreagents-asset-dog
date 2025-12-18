"""
Maintenance API router
"""
from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Dict, Any, Optional
from datetime import datetime
from decimal import Decimal
import logging

from models.maintenance import MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse, MaintenancesListResponse, MaintenanceDeleteResponse, MaintenanceStatsResponse, MaintenanceInventoryItem
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets/maintenance", tags=["maintenance"])


@router.get("", response_model=MaintenancesListResponse)
async def list_maintenances(
    assetId: Optional[str] = Query(None, description="Filter by asset ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in title, details, maintenanceBy"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=500),
    auth: dict = Depends(verify_auth)
):
    """List maintenance records with optional filters"""
    try:
        skip = (page - 1) * pageSize
        
        # Build where clause
        where: Dict[str, Any] = {}
        if assetId:
            where["assetId"] = assetId
        if status:
            where["status"] = status
        if search:
            where["OR"] = [
                {"title": {"contains": search, "mode": "insensitive"}},
                {"details": {"contains": search, "mode": "insensitive"}},
                {"maintenanceBy": {"contains": search, "mode": "insensitive"}}
            ]
        
        # Get total count
        total = await prisma.assetsmaintenance.count(where=where)
        
        # Fetch maintenances
        maintenances = await prisma.assetsmaintenance.find_many(
            where=where,
            include={
                "asset": {
                    "include": {
                        "category": True,
                        "subCategory": True
                    }
                },
                "inventoryItems": {
                    "include": {
                        "inventoryItem": True
                    }
                }
            },
            order={"createdAt": "desc"},
            skip=skip,
            take=pageSize
        )
        
        total_pages = (total + pageSize - 1) // pageSize
        
        # Format response
        maintenances_list = []
        for m in maintenances:
            maintenance_dict = {
                "id": str(m.id),
                "assetId": str(m.assetId),
                "title": m.title,
                "details": m.details,
                "dueDate": m.dueDate.isoformat() if m.dueDate and hasattr(m.dueDate, 'isoformat') else (str(m.dueDate) if m.dueDate else None),
                "maintenanceBy": m.maintenanceBy,
                "status": m.status,
                "dateCompleted": m.dateCompleted.isoformat() if m.dateCompleted and hasattr(m.dateCompleted, 'isoformat') else (str(m.dateCompleted) if m.dateCompleted else None),
                "dateCancelled": m.dateCancelled.isoformat() if m.dateCancelled and hasattr(m.dateCancelled, 'isoformat') else (str(m.dateCancelled) if m.dateCancelled else None),
                "cost": float(m.cost) if m.cost else None,
                "isRepeating": m.isRepeating,
                "createdAt": m.createdAt.isoformat() if hasattr(m.createdAt, 'isoformat') else str(m.createdAt),
                "asset": {
                    "id": str(m.asset.id),
                    "assetTagId": str(m.asset.assetTagId),
                    "description": str(m.asset.description),
                    "category": {
                        "id": str(m.asset.category.id),
                        "name": str(m.asset.category.name)
                    } if m.asset.category else None,
                    "subCategory": {
                        "id": str(m.asset.subCategory.id),
                        "name": str(m.asset.subCategory.name)
                    } if m.asset.subCategory else None
                } if m.asset else None,
                "inventoryItems": [
                    {
                        "id": str(inv_item.id),
                        "maintenanceId": str(inv_item.maintenanceId),
                        "inventoryItemId": str(inv_item.inventoryItemId),
                        "quantity": float(inv_item.quantity),
                        "unitCost": float(inv_item.unitCost) if inv_item.unitCost else None,
                        "inventoryItem": {
                            "id": str(inv_item.inventoryItem.id),
                            "itemCode": str(inv_item.inventoryItem.itemCode),
                            "name": str(inv_item.inventoryItem.name),
                            "unit": str(inv_item.inventoryItem.unit) if inv_item.inventoryItem.unit else None
                        } if inv_item.inventoryItem else None
                    }
                    for inv_item in (m.inventoryItems or [])
                ] if m.inventoryItems else []
            }
            maintenances_list.append(maintenance_dict)
        
        return MaintenancesListResponse(
            maintenances=maintenances_list,
            pagination={
                "page": page,
                "pageSize": pageSize,
                "total": total,
                "totalPages": total_pages,
                "hasNextPage": page < total_pages,
                "hasPreviousPage": page > 1
            }
        )
    
    except Exception as e:
        logger.error(f"Error listing maintenances: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch maintenances")


@router.delete("/{maintenance_id}", response_model=MaintenanceDeleteResponse)
async def delete_maintenance(
    maintenance_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a maintenance record"""
    try:
        # Check if maintenance record exists
        maintenance = await prisma.assetsmaintenance.find_unique(
            where={"id": maintenance_id}
        )
        
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
        
        # Delete the maintenance record
        await prisma.assetsmaintenance.delete(
            where={"id": maintenance_id}
        )
        
        return MaintenanceDeleteResponse(success=True, message="Maintenance record deleted successfully")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting maintenance: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete maintenance record")


@router.get("/{maintenance_id}")
async def get_maintenance(
    maintenance_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get a single maintenance record by ID"""
    try:
        maintenance = await prisma.assetsmaintenance.find_unique(
            where={"id": maintenance_id},
            include={
                "asset": True,
                "inventoryItems": {
                    "include": {
                        "inventoryItem": True
                    }
                }
            }
        )
        
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
        
        # Convert to dict for response
        maintenance_dict = maintenance.model_dump() if hasattr(maintenance, 'model_dump') else maintenance.__dict__.copy()
        
        return {"maintenance": maintenance_dict}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching maintenance: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch maintenance record")


@router.put("", response_model=MaintenanceResponse)
async def update_maintenance(
    data: MaintenanceUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update a maintenance record"""
    try:
        if not data.id:
            raise HTTPException(status_code=400, detail="Maintenance ID is required")
        
        # Get current maintenance
        current_maintenance = await prisma.assetsmaintenance.find_unique(
            where={"id": data.id},
            include={
                "inventoryItems": {
                    "include": {
                        "inventoryItem": True
                    }
                }
            }
        )
        
        if not current_maintenance:
            raise HTTPException(status_code=404, detail="Maintenance not found")
        
        previous_status = current_maintenance.status
        is_status_changing_to_completed = data.status and data.status == 'Completed' and previous_status != 'Completed'
        is_status_changing_from_completed = data.status and previous_status == 'Completed' and data.status != 'Completed'
        
        # Validate status-specific fields
        if data.status == 'Completed' and not data.dateCompleted:
            raise HTTPException(status_code=400, detail="Date completed is required when status is Completed")
        
        if data.status == 'Cancelled' and not data.dateCancelled:
            raise HTTPException(status_code=400, detail="Date cancelled is required when status is Cancelled")
        
        # Build update data
        update_data = {}
        
        if data.title is not None:
            update_data["title"] = data.title
        if data.details is not None:
            update_data["details"] = data.details
        if data.dueDate is not None:
            update_data["dueDate"] = parse_date(data.dueDate) if data.dueDate else None
        if data.maintenanceBy is not None:
            update_data["maintenanceBy"] = data.maintenanceBy
        if data.status is not None:
            update_data["status"] = data.status
        if data.dateCompleted is not None:
            update_data["dateCompleted"] = parse_date(data.dateCompleted) if data.dateCompleted else None
        if data.dateCancelled is not None:
            update_data["dateCancelled"] = parse_date(data.dateCancelled) if data.dateCancelled else None
        if data.cost is not None:
            update_data["cost"] = data.cost
        if data.isRepeating is not None:
            update_data["isRepeating"] = data.isRepeating
        
        # Handle inventory items if status is changing to Completed
        if is_status_changing_to_completed and data.inventoryItems:
            async with prisma.tx() as transaction:
                # Validate and deduct inventory stock
                for item in data.inventoryItems:
                    inventory_item = await transaction.inventoryitem.find_unique(
                        where={"id": item.inventoryItemId}
                    )
                    
                    if not inventory_item:
                        raise HTTPException(status_code=404, detail=f"Inventory item not found: {item.inventoryItemId}")
                    
                    current_stock = float(inventory_item.currentStock) if inventory_item.currentStock else 0
                    if current_stock < item.quantity:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Insufficient stock for {inventory_item.name} ({inventory_item.itemCode}). Available: {current_stock}, Required: {item.quantity}"
                        )
                    
                    # Deduct stock
                    await transaction.inventoryitem.update(
                        where={"id": item.inventoryItemId},
                        data={"currentStock": {"decrement": item.quantity}}
                    )
                
                # Update maintenance
                maintenance = await transaction.assetsmaintenance.update(
                    where={"id": data.id},
                    data=update_data,
                    include={
                        "asset": True,
                        "inventoryItems": {
                            "include": {
                                "inventoryItem": True
                            }
                        }
                    }
                )
        elif is_status_changing_from_completed and current_maintenance.inventoryItems:
            async with prisma.tx() as transaction:
                # Restore inventory stock
                for inv_item in current_maintenance.inventoryItems:
                    await transaction.inventoryitem.update(
                        where={"id": inv_item.inventoryItemId},
                        data={"currentStock": {"increment": float(inv_item.quantity)}}
                    )
                
                # Update maintenance
                maintenance = await transaction.assetsmaintenance.update(
                    where={"id": data.id},
                    data=update_data,
                    include={
                        "asset": True,
                        "inventoryItems": {
                            "include": {
                                "inventoryItem": True
                            }
                        }
                    }
                )
        else:
            # Simple update without inventory changes
            maintenance = await prisma.assetsmaintenance.update(
                where={"id": data.id},
                data=update_data,
                include={
                    "asset": True,
                    "inventoryItems": {
                        "include": {
                            "inventoryItem": True
                        }
                    }
                }
            )
        
        # Convert to dict for response
        maintenance_dict = maintenance.model_dump() if hasattr(maintenance, 'model_dump') else maintenance.__dict__.copy()
        
        return MaintenanceResponse(success=True, maintenance=maintenance_dict)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating maintenance: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update maintenance")


def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance(
    maintenance_data: MaintenanceCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a maintenance record"""
    try:
        if not maintenance_data.assetId:
            raise HTTPException(status_code=400, detail="Asset ID is required")
        
        if not maintenance_data.title:
            raise HTTPException(status_code=400, detail="Maintenance title is required")
        
        if not maintenance_data.status:
            raise HTTPException(status_code=400, detail="Maintenance status is required")
        
        # Validate status-specific fields
        if maintenance_data.status == 'Completed' and not maintenance_data.dateCompleted:
            raise HTTPException(status_code=400, detail="Date completed is required when status is Completed")
        
        if maintenance_data.status == 'Cancelled' and not maintenance_data.dateCancelled:
            raise HTTPException(status_code=400, detail="Date cancelled is required when status is Cancelled")
        
        # Check if asset exists
        asset = await prisma.assets.find_unique(where={"id": maintenance_data.assetId})
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Validate inventory items if provided
        if maintenance_data.inventoryItems and len(maintenance_data.inventoryItems) > 0:
            if maintenance_data.status == 'Completed':
                for item in maintenance_data.inventoryItems:
                    inventory_item = await prisma.inventoryitem.find_unique(
                        where={"id": item.inventoryItemId}
                    )
                    
                    if not inventory_item:
                        raise HTTPException(status_code=404, detail=f"Inventory item not found: {item.inventoryItemId}")
                    
                    quantity = float(item.quantity)
                    current_stock = float(inventory_item.currentStock) if inventory_item.currentStock else 0.0
                    if current_stock < quantity:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Insufficient stock for {inventory_item.name} ({inventory_item.itemCode}). Available: {current_stock}, Required: {quantity}"
                        )
        
        # Get user info for inventory transactions
        user_name = (
            auth.get("user", {}).get("user_metadata", {}).get("name") or
            auth.get("user", {}).get("user_metadata", {}).get("full_name") or
            auth.get("user", {}).get("email", "").split("@")[0] or
            auth.get("user", {}).get("email") or
            auth.get("user", {}).get("id", "Unknown")
        )
        
        # Create maintenance record and update asset status in a transaction
        async with prisma.tx() as transaction:
            # Create maintenance record
            maintenance = await transaction.assetsmaintenance.create(
                data={
                    "assetId": maintenance_data.assetId,
                    "title": maintenance_data.title,
                    "details": maintenance_data.details,
                    "dueDate": parse_date(maintenance_data.dueDate) if maintenance_data.dueDate else None,
                    "maintenanceBy": maintenance_data.maintenanceBy,
                    "status": maintenance_data.status,
                    "dateCompleted": parse_date(maintenance_data.dateCompleted) if maintenance_data.dateCompleted else None,
                    "dateCancelled": parse_date(maintenance_data.dateCancelled) if maintenance_data.dateCancelled else None,
                    "cost": Decimal(str(maintenance_data.cost)) if maintenance_data.cost else None,
                    "isRepeating": maintenance_data.isRepeating
                },
                include={
                    "asset": {
                        "include": {
                            "category": True,
                            "subCategory": True
                        }
                    }
                }
            )
            
            # Create inventory items records if provided
            if maintenance_data.inventoryItems and len(maintenance_data.inventoryItems) > 0:
                for item in maintenance_data.inventoryItems:
                    quantity = float(item.quantity)
                    unit_cost = float(item.unitCost) if item.unitCost else None
                    
                    # Get inventory item to use its unit cost if not provided
                    inventory_item = await transaction.inventoryitem.find_unique(
                        where={"id": item.inventoryItemId}
                    )
                    
                    final_unit_cost = unit_cost if unit_cost is not None else (float(inventory_item.unitCost) if inventory_item and inventory_item.unitCost else None)
                    
                    await transaction.maintenanceinventoryitem.create(
                        data={
                            "maintenanceId": maintenance.id,
                            "inventoryItemId": item.inventoryItemId,
                            "quantity": quantity,
                            "unitCost": Decimal(str(final_unit_cost)) if final_unit_cost is not None else None
                        }
                    )
                    
                    # If status is Completed, create inventory transaction and reduce stock
                    if maintenance_data.status == 'Completed':
                        # Create OUT transaction
                        await transaction.inventorytransaction.create(
                            data={
                                "inventoryItemId": item.inventoryItemId,
                                "transactionType": "OUT",
                                "quantity": quantity,
                                "unitCost": Decimal(str(final_unit_cost)) if final_unit_cost is not None else None,
                                "reference": f"Maintenance: {maintenance_data.title}",
                                "notes": f"Maintenance record: {maintenance.id}",
                                "actionBy": user_name,
                                "transactionDate": parse_date(maintenance_data.dateCompleted) if maintenance_data.dateCompleted else datetime.now()
                            }
                        )
                        
                        # Update inventory item stock
                        await transaction.inventoryitem.update(
                            where={"id": item.inventoryItemId},
                            data={
                                "currentStock": {
                                    "decrement": quantity
                                }
                            }
                        )
            
            # Update asset status based on maintenance status
            new_asset_status = None
            if maintenance_data.status == 'Completed' or maintenance_data.status == 'Cancelled':
                new_asset_status = 'Available'
            elif maintenance_data.status == 'Scheduled' or maintenance_data.status == 'In progress':
                new_asset_status = 'Maintenance'
            
            if new_asset_status is not None:
                await transaction.assets.update(
                    where={"id": maintenance_data.assetId},
                    data={"status": new_asset_status}
                )
            
            # Fetch maintenance with inventory items
            maintenance_with_items = await transaction.assetsmaintenance.find_unique(
                where={"id": maintenance.id},
                include={
                    "asset": {
                        "include": {
                            "category": True,
                            "subCategory": True
                        }
                    },
                    "inventoryItems": {
                        "include": {
                            "inventoryItem": True
                        }
                    }
                }
            )
            
            # Format response
            maintenance_dict = {
                "id": str(maintenance_with_items.id),
                "assetId": str(maintenance_with_items.assetId),
                "title": maintenance_with_items.title,
                "details": maintenance_with_items.details,
                "dueDate": maintenance_with_items.dueDate.isoformat() if maintenance_with_items.dueDate and hasattr(maintenance_with_items.dueDate, 'isoformat') else (str(maintenance_with_items.dueDate) if maintenance_with_items.dueDate else None),
                "maintenanceBy": maintenance_with_items.maintenanceBy,
                "status": maintenance_with_items.status,
                "dateCompleted": maintenance_with_items.dateCompleted.isoformat() if maintenance_with_items.dateCompleted and hasattr(maintenance_with_items.dateCompleted, 'isoformat') else (str(maintenance_with_items.dateCompleted) if maintenance_with_items.dateCompleted else None),
                "dateCancelled": maintenance_with_items.dateCancelled.isoformat() if maintenance_with_items.dateCancelled and hasattr(maintenance_with_items.dateCancelled, 'isoformat') else (str(maintenance_with_items.dateCancelled) if maintenance_with_items.dateCancelled else None),
                "cost": float(maintenance_with_items.cost) if maintenance_with_items.cost else None,
                "isRepeating": maintenance_with_items.isRepeating,
                "createdAt": maintenance_with_items.createdAt.isoformat() if hasattr(maintenance_with_items.createdAt, 'isoformat') else str(maintenance_with_items.createdAt),
                "asset": {
                    "id": str(maintenance_with_items.asset.id),
                    "assetTagId": str(maintenance_with_items.asset.assetTagId),
                    "description": str(maintenance_with_items.asset.description),
                    "category": {
                        "id": str(maintenance_with_items.asset.category.id),
                        "name": str(maintenance_with_items.asset.category.name)
                    } if maintenance_with_items.asset.category else None,
                    "subCategory": {
                        "id": str(maintenance_with_items.asset.subCategory.id),
                        "name": str(maintenance_with_items.asset.subCategory.name)
                    } if maintenance_with_items.asset.subCategory else None
                } if maintenance_with_items.asset else None,
                "inventoryItems": [
                    {
                        "id": str(inv_item.id),
                        "maintenanceId": str(inv_item.maintenanceId),
                        "inventoryItemId": str(inv_item.inventoryItemId),
                        "quantity": float(inv_item.quantity),
                        "unitCost": float(inv_item.unitCost) if inv_item.unitCost else None,
                        "inventoryItem": {
                            "id": str(inv_item.inventoryItem.id),
                            "itemCode": str(inv_item.inventoryItem.itemCode),
                            "name": str(inv_item.inventoryItem.name),
                            "unit": str(inv_item.inventoryItem.unit) if inv_item.inventoryItem.unit else None
                        } if inv_item.inventoryItem else None
                    }
                    for inv_item in (maintenance_with_items.inventoryItems or [])
                ] if maintenance_with_items.inventoryItems else []
            }
            
            return MaintenanceResponse(
                success=True,
                maintenance=maintenance_dict
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating maintenance: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create maintenance: {str(e)}")

@router.get("/stats", response_model=MaintenanceStatsResponse)
async def get_maintenance_stats(
    auth: dict = Depends(verify_auth)
):
    """Get maintenance statistics"""
    try:
        # Count scheduled maintenances today
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = datetime(today.year, today.month, today.day + 1)
        
        scheduled_today_count = await prisma.assetsmaintenance.count(
            where={
                "status": "Scheduled",
                "dueDate": {
                    "gte": today,
                    "lt": tomorrow
                }
            }
        )

        # Count in progress maintenances
        in_progress_count = await prisma.assetsmaintenance.count(
            where={"status": "In progress"}
        )

        # Get recent maintenances (last 10)
        recent_maintenances_data = await prisma.assetsmaintenance.find_many(
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
        recent_maintenances = []
        for maintenance in recent_maintenances_data:
            maintenance_dict = {
                "id": str(maintenance.id),
                "title": maintenance.title,
                "details": maintenance.details,
                "dueDate": maintenance.dueDate.isoformat() if maintenance.dueDate and hasattr(maintenance.dueDate, 'isoformat') else (str(maintenance.dueDate) if maintenance.dueDate else None),
                "maintenanceBy": maintenance.maintenanceBy,
                "status": maintenance.status,
                "dateCompleted": maintenance.dateCompleted.isoformat() if maintenance.dateCompleted and hasattr(maintenance.dateCompleted, 'isoformat') else (str(maintenance.dateCompleted) if maintenance.dateCompleted else None),
                "createdAt": maintenance.createdAt.isoformat() if hasattr(maintenance.createdAt, 'isoformat') else str(maintenance.createdAt),
                "asset": {
                    "id": str(maintenance.asset.id),
                    "assetTagId": str(maintenance.asset.assetTagId),
                    "description": str(maintenance.asset.description),
                    "category": {
                        "id": str(maintenance.asset.category.id),
                        "name": str(maintenance.asset.category.name)
                    } if maintenance.asset.category else None,
                    "subCategory": {
                        "id": str(maintenance.asset.subCategory.id),
                        "name": str(maintenance.asset.subCategory.name)
                    } if maintenance.asset.subCategory else None
                } if maintenance.asset else None
            }
            recent_maintenances.append(maintenance_dict)

        return MaintenanceStatsResponse(
            scheduledTodayCount=scheduled_today_count,
            inProgressCount=in_progress_count,
            recentMaintenances=recent_maintenances
        )

    except Exception as e:
        logger.error(f"Error fetching maintenance statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch maintenance statistics")

