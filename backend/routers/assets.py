"""
Assets API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, Form, Request
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from decimal import Decimal
import logging
import asyncio
import os
from supabase import create_client, Client

from models.assets import (
    Asset,
    AssetCreate,
    AssetUpdate,
    AssetsResponse,
    AssetResponse,
    StatusesResponse,
    SummaryResponse,
    DeleteResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
    BulkRestoreRequest,
    BulkRestoreResponse,
    PaginationInfo,
    SummaryInfo,
    CategoryInfo,
    SubCategoryInfo,
    EmployeeInfo,
    CheckoutInfo,
    LeaseInfo,
    AuditHistoryInfo
)
from auth import verify_auth, SUPABASE_URL, SUPABASE_ANON_KEY
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets", tags=["assets"])

def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse date string to datetime"""
    if not date_str:
        return None
    try:
        # Try ISO format first
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        try:
            # Try common formats
            for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f']:
                try:
                    return datetime.strptime(date_str, fmt)
                except:
                    continue
        except:
            pass
    return None

def build_search_conditions(search: str, search_fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Build search conditions for assets"""
    conditions = []
    
    # Default fields to search if not specified
    fields_to_search = search_fields or [
        'assetTagId', 'description', 'brand', 'model', 'serialNo', 'owner',
        'issuedTo', 'department', 'site', 'location'
    ]
    
    for field in fields_to_search:
        if field == 'assetTagId':
            conditions.append({"assetTagId": {"contains": search, "mode": "insensitive"}})
        elif field == 'description':
            conditions.append({"description": {"contains": search, "mode": "insensitive"}})
        elif field == 'brand':
            conditions.append({"brand": {"contains": search, "mode": "insensitive"}})
        elif field == 'model':
            conditions.append({"model": {"contains": search, "mode": "insensitive"}})
        elif field == 'serialNo':
            conditions.append({"serialNo": {"contains": search, "mode": "insensitive"}})
        elif field == 'owner':
            conditions.append({"owner": {"contains": search, "mode": "insensitive"}})
        elif field == 'issuedTo':
            conditions.append({"issuedTo": {"contains": search, "mode": "insensitive"}})
        elif field == 'department':
            conditions.append({"department": {"contains": search, "mode": "insensitive"}})
        elif field == 'site':
            conditions.append({"site": {"contains": search, "mode": "insensitive"}})
        elif field == 'location':
            conditions.append({"location": {"contains": search, "mode": "insensitive"}})
        elif field == 'category.name':
            conditions.append({"category": {"name": {"contains": search, "mode": "insensitive"}}})
        elif field == 'subCategory.name':
            conditions.append({"subCategory": {"name": {"contains": search, "mode": "insensitive"}}})
        elif field == 'status':
            conditions.append({"status": {"contains": search, "mode": "insensitive"}})
        elif field == 'purchasedFrom':
            conditions.append({"purchasedFrom": {"contains": search, "mode": "insensitive"}})
        elif field == 'additionalInformation':
            conditions.append({"additionalInformation": {"contains": search, "mode": "insensitive"}})
        elif field == 'xeroAssetNo':
            conditions.append({"xeroAssetNo": {"contains": search, "mode": "insensitive"}})
        elif field == 'pbiNumber':
            conditions.append({"pbiNumber": {"contains": search, "mode": "insensitive"}})
        elif field == 'poNumber':
            conditions.append({"poNumber": {"contains": search, "mode": "insensitive"}})
        elif field == 'paymentVoucherNumber':
            conditions.append({"paymentVoucherNumber": {"contains": search, "mode": "insensitive"}})
        elif field == 'assetType':
            conditions.append({"assetType": {"contains": search, "mode": "insensitive"}})
        elif field == 'remarks':
            conditions.append({"remarks": {"contains": search, "mode": "insensitive"}})
        elif field == 'qr':
            conditions.append({"qr": {"contains": search, "mode": "insensitive"}})
        elif field == 'oldAssetTag':
            conditions.append({"oldAssetTag": {"contains": search, "mode": "insensitive"}})
        elif field == 'depreciationMethod':
            conditions.append({"depreciationMethod": {"contains": search, "mode": "insensitive"}})
        elif field == 'checkouts.checkoutDate':
            search_date = parse_date(search)
            if search_date:
                start_of_day = search_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = search_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                conditions.append({
                    "checkouts": {
                        "some": {
                            "checkoutDate": {
                                "gte": start_of_day,
                                "lte": end_of_day
                            }
                        }
                    }
                })
        elif field == 'checkouts.expectedReturnDate':
            search_date = parse_date(search)
            if search_date:
                start_of_day = search_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = search_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                conditions.append({
                    "checkouts": {
                        "some": {
                            "expectedReturnDate": {
                                "gte": start_of_day,
                                "lte": end_of_day
                            }
                        }
                    }
                })
        elif field == 'auditHistory.auditDate':
            search_date = parse_date(search)
            if search_date:
                start_of_day = search_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = search_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                conditions.append({
                    "auditHistory": {
                        "some": {
                            "auditDate": {
                                "gte": start_of_day,
                                "lte": end_of_day
                            }
                        }
                    }
                })
        elif field == 'auditHistory.auditType':
            conditions.append({"auditHistory": {"some": {"auditType": {"contains": search, "mode": "insensitive"}}}})
        elif field == 'auditHistory.auditor':
            conditions.append({"auditHistory": {"some": {"auditor": {"contains": search, "mode": "insensitive"}}}})
    
    # Add employee search if not filtering by specific fields or if employee fields are included
    if not search_fields or any(f for f in search_fields if 'employee' in f):
        conditions.extend([
            {"checkouts": {"some": {"employeeUser": {"name": {"contains": search, "mode": "insensitive"}}}}},
            {"checkouts": {"some": {"employeeUser": {"email": {"contains": search, "mode": "insensitive"}}}}}
        ])
    
    return conditions

def build_where_clause(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    include_deleted: bool = False,
    search_fields: Optional[str] = None
) -> Dict[str, Any]:
    """Build Prisma where clause for assets query"""
    where_clause: Dict[str, Any] = {}
    
    # Exclude soft-deleted assets by default
    if not include_deleted:
        where_clause["isDeleted"] = False
    
    # Search filter
    if search:
        search_field_list = search_fields.split(',') if search_fields else None
        search_conditions = build_search_conditions(search, search_field_list)
        if search_conditions:
            where_clause["OR"] = search_conditions
    
    # Category filter
    if category and category != 'all':
        where_clause["category"] = {
            "name": {"equals": category, "mode": "insensitive"}
        }
    
    # Status filter
    if status and status != 'all':
        where_clause["status"] = {"equals": status, "mode": "insensitive"}
    
    return where_clause

@router.get("", response_model=Union[AssetsResponse, StatusesResponse, SummaryResponse])
async def get_assets(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    withMaintenance: bool = Query(False),
    includeDeleted: bool = Query(False),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=10000),
    searchFields: Optional[str] = Query(None),
    statuses: bool = Query(False, description="Return only unique statuses"),
    summary: bool = Query(False, description="Return only summary statistics"),
    auth: dict = Depends(verify_auth)
):
    """Get all assets with optional search filter and pagination"""
    try:
        where_clause = build_where_clause(
            search=search,
            category=category,
            status=status,
            include_deleted=includeDeleted,
            search_fields=searchFields
        )
        
        skip = (page - 1) * pageSize
        
        # Check if unique statuses are requested
        if statuses:
            # Fetch all matching assets and extract unique statuses
            # Prisma Python doesn't support select, so we fetch all fields
            assets_with_status = await prisma.assets.find_many(
                where=where_clause
            )
            unique_statuses = sorted(list(set(
                asset.status for asset in assets_with_status if asset.status
            )))
            return StatusesResponse(statuses=unique_statuses)
        
        # Check if summary is requested
        if summary:
            total_assets = await prisma.assets.count(where=where_clause)
            # Fetch all matching assets to calculate sum (Prisma Python doesn't support select)
            assets_for_sum = await prisma.assets.find_many(
                where=where_clause
            )
            total_value = sum(
                float(asset.cost) if asset.cost is not None else 0.0
                for asset in assets_for_sum
            )
            available_assets = await prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Available", "mode": "insensitive"}
                }
            )
            checked_out_assets = await prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Checked out", "mode": "insensitive"}
                }
            )
            
            # Calculate value of checked out assets only
            checked_out_where = {
                **where_clause,
                "status": {"equals": "Checked out", "mode": "insensitive"}
            }
            checked_out_assets_for_value = await prisma.assets.find_many(
                where=checked_out_where
            )
            checked_out_value = sum(
                float(asset.cost) if asset.cost is not None else 0.0
                for asset in checked_out_assets_for_value
            )
            
            return SummaryResponse(
                summary=SummaryInfo(
                    totalAssets=total_assets,
                    totalValue=total_value,
                    availableAssets=available_assets,
                    checkedOutAssets=checked_out_assets,
                    checkedOutAssetsValue=checked_out_value
                )
            )
        
        # Optimize includes for deleted assets - they don't need heavy relations
        # For deleted assets, we only need basic info (category, subCategory)
        # For active assets, include all relations
        include_dict: Dict[str, Any] = {
            "category": True,
            "subCategory": True,
        }
        
        # Only include heavy relations for non-deleted assets or when specifically requested
        if not includeDeleted or withMaintenance:
            include_dict.update({
                "checkouts": {
                    "include": {
                        "employeeUser": True
                    }
                },
                "leases": {
                    "where": {
                        "OR": [
                            {"leaseEndDate": None},
                            {"leaseEndDate": {"gte": datetime.now()}}
                        ]
                    },
                    "include": {
                        "returns": True
                    }
                },
                "auditHistory": True,
            })
            if withMaintenance:
                include_dict["maintenances"] = {
                    "include": {
                        "inventoryItems": {
                            "include": {
                                "inventoryItem": True
                            }
                        }
                    }
                }
        
        # Get total count and assets in parallel
        total_count, assets_data = await asyncio.gather(
            prisma.assets.count(where=where_clause),
            prisma.assets.find_many(
                where=where_clause,
                include=include_dict,
                order=[{"createdAt": "desc"}, {"id": "desc"}],
                skip=skip,
                take=pageSize
            )
        )
        
        # Get image counts for all assets - optimized batch query
        assets_with_image_count = []
        image_counts = {}
        if assets_data:
            asset_tag_ids = [asset.assetTagId for asset in assets_data]
            # Batch fetch all image counts at once instead of individual queries
            if asset_tag_ids:
                all_images = await prisma.assetsimage.find_many(
                    where={"assetTagId": {"in": asset_tag_ids}}
                )
                # Count images per asset tag ID
                for asset_tag_id in asset_tag_ids:
                    image_counts[asset_tag_id] = sum(1 for img in all_images if img.assetTagId == asset_tag_id)
        
        # Convert to Asset models
        assets = []
        for asset_data in assets_data:
            try:
                # Convert related data
                category_info = None
                if asset_data.category:
                    category_info = CategoryInfo(
                        id=str(asset_data.category.id),
                        name=str(asset_data.category.name)
                    )
                
                sub_category_info = None
                if asset_data.subCategory:
                    sub_category_info = SubCategoryInfo(
                        id=str(asset_data.subCategory.id),
                        name=str(asset_data.subCategory.name)
                    )
                
                checkouts_list = []
                if hasattr(asset_data, 'checkouts') and asset_data.checkouts:
                    # Sort by checkoutDate descending and take only the first one
                    sorted_checkouts = sorted(
                        asset_data.checkouts,
                        key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min,
                        reverse=True
                    )[:1]
                    for checkout in sorted_checkouts:
                        employee_info = None
                        if checkout.employeeUser:
                            employee_info = EmployeeInfo(
                                id=str(checkout.employeeUser.id),
                                name=str(checkout.employeeUser.name),
                                email=str(checkout.employeeUser.email)
                            )
                        checkouts_list.append(CheckoutInfo(
                            id=str(checkout.id),
                            checkoutDate=checkout.checkoutDate,
                            expectedReturnDate=checkout.expectedReturnDate,
                            employeeUser=employee_info
                        ))
                
                leases_list = []
                if hasattr(asset_data, 'leases') and asset_data.leases:
                    # Sort by leaseStartDate descending and take only the first one
                    sorted_leases = sorted(
                        asset_data.leases,
                        key=lambda x: x.leaseStartDate if x.leaseStartDate else datetime.min,
                        reverse=True
                    )[:1]
                    for lease in sorted_leases:
                        # Get first return if exists
                        first_return = None
                        if lease.returns and len(lease.returns) > 0:
                            first_return = lease.returns[0]
                        
                        leases_list.append(LeaseInfo(
                            id=str(lease.id),
                            leaseStartDate=lease.leaseStartDate,
                            leaseEndDate=lease.leaseEndDate,
                            lessee=lease.lessee
                        ))
                
                audit_history_list = []
                if hasattr(asset_data, 'auditHistory') and asset_data.auditHistory:
                    # Sort by auditDate descending and take only the first 5
                    sorted_audits = sorted(
                        asset_data.auditHistory,
                        key=lambda x: x.auditDate if x.auditDate else datetime.min,
                        reverse=True
                    )[:5]
                    for audit in sorted_audits:
                        audit_history_list.append(AuditHistoryInfo(
                            id=str(audit.id),
                            auditDate=audit.auditDate,
                            auditType=audit.auditType,
                            auditor=audit.auditor
                        ))
                
                asset = Asset(
                    id=str(asset_data.id),
                    assetTagId=str(asset_data.assetTagId),
                    description=str(asset_data.description),
                    purchasedFrom=asset_data.purchasedFrom,
                    purchaseDate=asset_data.purchaseDate,
                    brand=asset_data.brand,
                    cost=asset_data.cost,
                    model=asset_data.model,
                    serialNo=asset_data.serialNo,
                    additionalInformation=asset_data.additionalInformation,
                    xeroAssetNo=asset_data.xeroAssetNo,
                    owner=asset_data.owner,
                    pbiNumber=asset_data.pbiNumber,
                    status=asset_data.status,
                    issuedTo=asset_data.issuedTo,
                    poNumber=asset_data.poNumber,
                    paymentVoucherNumber=asset_data.paymentVoucherNumber,
                    assetType=asset_data.assetType,
                    deliveryDate=asset_data.deliveryDate,
                    unaccountedInventory=asset_data.unaccountedInventory,
                    remarks=asset_data.remarks,
                    qr=asset_data.qr,
                    oldAssetTag=asset_data.oldAssetTag,
                    depreciableAsset=asset_data.depreciableAsset,
                    depreciableCost=asset_data.depreciableCost,
                    salvageValue=asset_data.salvageValue,
                    assetLifeMonths=asset_data.assetLifeMonths,
                    depreciationMethod=asset_data.depreciationMethod,
                    dateAcquired=asset_data.dateAcquired,
                    categoryId=asset_data.categoryId,
                    category=category_info,
                    subCategoryId=asset_data.subCategoryId,
                    subCategory=sub_category_info,
                    department=asset_data.department,
                    site=asset_data.site,
                    location=asset_data.location,
                    createdAt=asset_data.createdAt,
                    updatedAt=asset_data.updatedAt,
                    deletedAt=asset_data.deletedAt,
                    isDeleted=asset_data.isDeleted,
                    checkouts=checkouts_list if checkouts_list else None,
                    leases=leases_list if leases_list else None,
                    auditHistory=audit_history_list if audit_history_list else None,
                    imagesCount=image_counts.get(asset_data.assetTagId, 0)
                )
                assets.append(asset)
            except Exception as e:
                logger.error(f"Error creating Asset model: {type(e).__name__}: {str(e)}", exc_info=True)
                continue
        
        # Calculate summary statistics in parallel
        # Fetch all matching assets to calculate sum (Prisma Python doesn't support select)
        assets_for_sum, available_assets, checked_out_assets = await asyncio.gather(
            prisma.assets.find_many(
                where=where_clause
            ),
            prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Available", "mode": "insensitive"}
                }
            ),
            prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Checked out", "mode": "insensitive"}
                }
            )
        )
        
        total_value = sum(
            float(asset.cost) if asset.cost is not None else 0.0
            for asset in assets_for_sum
        )
        total_pages = (total_count + pageSize - 1) // pageSize if total_count > 0 else 0
        
        return AssetsResponse(
            assets=assets,
            pagination=PaginationInfo(
                page=page,
                pageSize=pageSize,
                total=total_count,
                totalPages=total_pages
            ),
            summary=SummaryInfo(
                totalAssets=total_count,
                totalValue=total_value,
                availableAssets=available_assets,
                checkedOutAssets=checked_out_assets
            )
        )
    
    except Exception as e:
        logger.error(f"Error fetching assets: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch assets")

@router.get("/{asset_id}/checkout")
async def get_asset_checkouts(
    asset_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get all checkout records for a specific asset"""
    try:
        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"id": asset_id}
        )
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Get all checkouts for this asset
        checkouts_data = await prisma.assetscheckout.find_many(
            where={"assetId": asset_id},
            include={
                "employeeUser": True,
                "checkins": True
            },
            order={"checkoutDate": "desc"}
        )
        
        # Format checkouts for response
        checkouts = []
        for checkout in checkouts_data:
            # Sort checkins by date descending and take the first one
            sorted_checkins = sorted(
                checkout.checkins or [],
                key=lambda x: x.checkinDate if hasattr(x, 'checkinDate') else datetime.min,
                reverse=True
            )[:1]
            
            checkout_dict = {
                "id": str(checkout.id),
                "assetId": str(checkout.assetId),
                "employeeUserId": str(checkout.employeeUserId) if checkout.employeeUserId else None,
                "checkoutDate": checkout.checkoutDate.isoformat() if hasattr(checkout.checkoutDate, 'isoformat') else str(checkout.checkoutDate),
                "expectedReturnDate": checkout.expectedReturnDate.isoformat() if checkout.expectedReturnDate and hasattr(checkout.expectedReturnDate, 'isoformat') else (str(checkout.expectedReturnDate) if checkout.expectedReturnDate else None),
                "createdAt": checkout.createdAt.isoformat() if hasattr(checkout.createdAt, 'isoformat') else str(checkout.createdAt),
                "updatedAt": checkout.updatedAt.isoformat() if hasattr(checkout.updatedAt, 'isoformat') else str(checkout.updatedAt),
                "employeeUser": {
                    "id": str(checkout.employeeUser.id),
                    "name": str(checkout.employeeUser.name),
                    "email": str(checkout.employeeUser.email)
                } if checkout.employeeUser else None,
                "checkins": [
                    {
                        "id": str(c.id),
                        "checkinDate": c.checkinDate.isoformat() if hasattr(c.checkinDate, 'isoformat') else str(c.checkinDate),
                    }
                    for c in sorted_checkins
                ]
            }
            checkouts.append(checkout_dict)
        
        return {"checkouts": checkouts}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching checkout records: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch checkout records")

@router.get("/{asset_id}/history")
async def get_asset_history(
    asset_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get all history logs for a specific asset"""
    try:
        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"id": asset_id}
        )
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Get all history logs for this asset
        logs_data = await prisma.assetshistorylogs.find_many(
            where={"assetId": asset_id},
            order={"eventDate": "desc"}
        )
        
        # Format logs for response
        logs = []
        for log in logs_data:
            log_dict = {
                "id": str(log.id),
                "assetId": str(log.assetId),
                "eventType": log.eventType,
                "field": log.field,
                "changeFrom": log.changeFrom,
                "changeTo": log.changeTo,
                "actionBy": log.actionBy,
                "eventDate": log.eventDate.isoformat() if hasattr(log.eventDate, 'isoformat') else str(log.eventDate),
                "createdAt": log.createdAt.isoformat() if hasattr(log.createdAt, 'isoformat') else str(log.createdAt),
                "notes": log.notes if hasattr(log, 'notes') else None,
                "status": log.status if hasattr(log, 'status') else None,
            }
            logs.append(log_dict)
        
        return {"logs": logs}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching history logs: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch history logs")

@router.post("/import")
async def import_assets(
    request: Dict[str, Any],
    auth: dict = Depends(verify_auth)
):
    """Import assets from Excel file"""
    try:
        assets = request.get("assets", [])
        
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        if not assets or not isinstance(assets, list):
            raise HTTPException(status_code=400, detail="Invalid request body. Expected an array of assets.")
        
        # Validate that assets have required fields
        invalid_assets = [asset for asset in assets if not asset or not isinstance(asset, dict) or not asset.get("assetTagId") or (isinstance(asset.get("assetTagId"), str) and asset.get("assetTagId", "").strip() == "")]
        
        if invalid_assets:
            invalid_indices = [assets.index(asset) + 2 for asset in invalid_assets]  # +2 because row 1 is header
            raise HTTPException(
                status_code=400,
                detail=f"Invalid data format: {len(invalid_assets)} row(s) are missing required 'Asset Tag ID' field. Please ensure your Excel file has the correct column headers.",
                headers={"X-Invalid-Rows": ",".join(map(str, invalid_indices))}
            )
        
        # Pre-process: collect all unique categories, subcategories, locations, departments, and sites
        unique_categories = set()
        unique_subcategories = set()
        unique_locations = set()
        unique_departments = set()
        unique_sites = set()
        subcategory_to_category_map = {}
        
        for asset in assets:
            category_name = asset.get("category", "").strip() if asset.get("category") else None
            subcategory_name = asset.get("subCategory", "").strip() if asset.get("subCategory") else None
            
            if category_name:
                unique_categories.add(category_name)
            if subcategory_name:
                unique_subcategories.add(subcategory_name)
                if category_name and subcategory_name not in subcategory_to_category_map:
                    subcategory_to_category_map[subcategory_name] = category_name
            
            if asset.get("location"):
                unique_locations.add(asset.get("location", "").strip())
            if asset.get("department"):
                unique_departments.add(asset.get("department", "").strip())
            if asset.get("site"):
                unique_sites.add(asset.get("site", "").strip())
        
        # Batch create categories
        category_map = {}
        if unique_categories:
            category_names_list = list(unique_categories)
            existing_categories = await prisma.category.find_many(
                where={"name": {"in": category_names_list}}
            )
            for cat in existing_categories:
                category_map[cat.name] = str(cat.id)
            
            missing_categories = [name for name in category_names_list if name not in category_map]
            if missing_categories:
                # Create missing categories
                for name in missing_categories:
                    try:
                        new_cat = await prisma.category.create(
                            data={"name": name, "description": "Auto-created during import"}
                        )
                        category_map[name] = str(new_cat.id)
                    except Exception:
                        # Category might have been created by another request, try to fetch it
                        existing = await prisma.category.find_first(where={"name": name})
                        if existing:
                            category_map[name] = str(existing.id)
        
        # Batch create subcategories
        subcategory_map = {}
        if unique_subcategories:
            subcategory_names_list = list(unique_subcategories)
            existing_subcategories = await prisma.subcategory.find_many(
                where={"name": {"in": subcategory_names_list}},
                include={"category": True}
            )
            
            for subcat in existing_subcategories:
                expected_parent = subcategory_to_category_map.get(subcat.name)
                if not expected_parent or subcat.category.name == expected_parent:
                    subcategory_map[subcat.name] = str(subcat.id)
            
            missing_subcategories = [name for name in subcategory_names_list if name not in subcategory_map]
            if missing_subcategories:
                # Group by parent category
                subcategories_by_category = {}
                for subcat_name in missing_subcategories:
                    parent_category_name = subcategory_to_category_map.get(subcat_name)
                    if parent_category_name and parent_category_name in category_map:
                        category_id = category_map[parent_category_name]
                        if category_id not in subcategories_by_category:
                            subcategories_by_category[category_id] = []
                        subcategories_by_category[category_id].append(subcat_name)
                    else:
                        # Use default category
                        default_key = "default"
                        if default_key not in subcategories_by_category:
                            subcategories_by_category[default_key] = []
                        subcategories_by_category[default_key].append(subcat_name)
                
                # Get or create default category
                default_category_id = None
                if "default" in subcategories_by_category:
                    default_category = await prisma.category.find_first()
                    if not default_category:
                        default_category = await prisma.category.create(
                            data={"name": "Default", "description": "Default category for subcategories without parent"}
                        )
                    default_category_id = str(default_category.id)
                
                # Create subcategories
                for category_id_or_default, subcat_names in subcategories_by_category.items():
                    parent_id = default_category_id if category_id_or_default == "default" else category_id_or_default
                    if parent_id:
                        for subcat_name in subcat_names:
                            try:
                                new_subcat = await prisma.subcategory.create(
                                    data={
                                        "name": subcat_name,
                                        "description": "Auto-created during import",
                                        "categoryId": parent_id
                                    }
                                )
                                subcategory_map[subcat_name] = str(new_subcat.id)
                            except Exception:
                                # Subcategory might exist, try to fetch it
                                existing = await prisma.subcategory.find_first(where={"name": subcat_name})
                                if existing:
                                    subcategory_map[subcat_name] = str(existing.id)
        
        # Batch create locations
        location_map = {}
        if unique_locations:
            location_names_list = list(unique_locations)
            existing_locations = await prisma.assetslocation.find_many(
                where={"name": {"in": location_names_list}}
            )
            for loc in existing_locations:
                location_map[loc.name] = str(loc.id)
            
            missing_locations = [name for name in location_names_list if name not in location_map]
            if missing_locations:
                for name in missing_locations:
                    try:
                        new_loc = await prisma.assetslocation.create(
                            data={"name": name, "description": "Auto-created during import"}
                        )
                        location_map[name] = str(new_loc.id)
                    except Exception:
                        existing = await prisma.assetslocation.find_first(where={"name": name})
                        if existing:
                            location_map[name] = str(existing.id)
        
        # Batch create departments
        department_map = {}
        if unique_departments:
            department_names_list = list(unique_departments)
            existing_departments = await prisma.assetsdepartment.find_many(
                where={"name": {"in": department_names_list}}
            )
            for dept in existing_departments:
                department_map[dept.name] = str(dept.id)
            
            missing_departments = [name for name in department_names_list if name not in department_map]
            if missing_departments:
                for name in missing_departments:
                    try:
                        new_dept = await prisma.assetsdepartment.create(
                            data={"name": name, "description": "Auto-created during import"}
                        )
                        department_map[name] = str(new_dept.id)
                    except Exception:
                        existing = await prisma.assetsdepartment.find_first(where={"name": name})
                        if existing:
                            department_map[name] = str(existing.id)
        
        # Batch create sites
        site_map = {}
        if unique_sites:
            site_names_list = list(unique_sites)
            existing_sites = await prisma.assetssite.find_many(
                where={"name": {"in": site_names_list}}
            )
            for site in existing_sites:
                site_map[site.name] = str(site.id)
            
            missing_sites = [name for name in site_names_list if name not in site_map]
            if missing_sites:
                for name in missing_sites:
                    try:
                        new_site = await prisma.assetssite.create(
                            data={"name": name, "description": "Auto-created during import"}
                        )
                        site_map[name] = str(new_site.id)
                    except Exception:
                        existing = await prisma.assetssite.find_first(where={"name": name})
                        if existing:
                            site_map[name] = str(existing.id)
        
        # Check for existing assets
        asset_tag_ids = [asset.get("assetTagId") for asset in assets if asset.get("assetTagId") and isinstance(asset.get("assetTagId"), str)]
        
        if not asset_tag_ids:
            raise HTTPException(status_code=400, detail="No valid Asset Tag IDs found in the import file. Please check your Excel file format.")
        
        existing_assets = await prisma.assets.find_many(
            where={"assetTagId": {"in": asset_tag_ids}},
            select={"assetTagId": True, "isDeleted": True}
        )
        
        existing_asset_tags = {asset.assetTagId for asset in existing_assets}
        deleted_asset_tags = {asset.assetTagId for asset in existing_assets if asset.isDeleted}
        
        # Helper functions
        def parse_number(value: Any) -> Optional[float]:
            if value is None or value == "":
                return None
            try:
                if isinstance(value, str):
                    value = value.replace(",", "")
                num = float(value)
                return num if not (num != num) else None  # Check for NaN
            except (ValueError, TypeError):
                return None
        
        def parse_boolean(value: Any) -> Optional[bool]:
            if value is None or value == "":
                return None
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                lower = value.lower().strip()
                if lower in ["true", "yes", "1"]:
                    return True
                if lower in ["false", "no", "0"]:
                    return False
            return bool(value) if value else None
        
        # Prepare data for batch insert
        assets_to_create = []
        for asset in assets:
            asset_tag_id = asset.get("assetTagId")
            if not asset_tag_id or asset_tag_id in existing_asset_tags:
                continue
            
            category_id = None
            if asset.get("category"):
                category_id = category_map.get(asset.get("category"))
            elif asset.get("categoryId"):
                category_id = asset.get("categoryId")
            
            subcategory_id = None
            if asset.get("subCategory"):
                subcategory_id = subcategory_map.get(asset.get("subCategory"))
            elif asset.get("subCategoryId"):
                subcategory_id = asset.get("subCategoryId")
            
            asset_data = {
                "assetTagId": asset_tag_id,
                "description": asset.get("description") or "",
                "purchasedFrom": asset.get("purchasedFrom"),
                "purchaseDate": parse_date(asset.get("purchaseDate")),
                "brand": asset.get("brand"),
                "cost": parse_number(asset.get("cost")),
                "model": asset.get("model"),
                "serialNo": asset.get("serialNo"),
                "additionalInformation": asset.get("additionalInformation"),
                "xeroAssetNo": asset.get("xeroAssetNo"),
                "owner": asset.get("owner"),
                "pbiNumber": asset.get("pbiNumber"),
                "status": asset.get("status"),
                "issuedTo": asset.get("issuedTo"),
                "poNumber": asset.get("poNumber"),
                "paymentVoucherNumber": asset.get("paymentVoucherNumber"),
                "assetType": asset.get("assetType"),
                "deliveryDate": parse_date(asset.get("deliveryDate")),
                "unaccountedInventory": parse_boolean(asset.get("unaccountedInventory") or asset.get("unaccounted2021Inventory")),
                "remarks": asset.get("remarks"),
                "qr": asset.get("qr"),
                "oldAssetTag": asset.get("oldAssetTag"),
                "depreciableAsset": parse_boolean(asset.get("depreciableAsset")) or False,
                "depreciableCost": parse_number(asset.get("depreciableCost")),
                "salvageValue": parse_number(asset.get("salvageValue")),
                "assetLifeMonths": int(asset.get("assetLifeMonths")) if asset.get("assetLifeMonths") else None,
                "depreciationMethod": asset.get("depreciationMethod"),
                "dateAcquired": parse_date(asset.get("dateAcquired")),
                "categoryId": category_id,
                "subCategoryId": subcategory_id,
                "department": asset.get("department"),
                "site": asset.get("site"),
                "location": asset.get("location"),
            }
            assets_to_create.append(asset_data)
        
        # Batch insert assets
        created_count = 0
        if assets_to_create:
            # Use create_many for better performance
            try:
                # Note: create_many returns an integer count in Prisma Python
                created_count = await prisma.assets.create_many(
                    data=assets_to_create,
                    skip_duplicates=True
                )
            except Exception as e:
                logger.error(f"Error creating assets: {e}", exc_info=True)
                # Fallback: create one by one
                for asset_data in assets_to_create:
                    try:
                        await prisma.assets.create(data=asset_data)
                        created_count += 1
                    except Exception:
                        pass
            
            # Create history logs for imported assets
            created_asset_tag_ids = [a["assetTagId"] for a in assets_to_create]
            created_assets = await prisma.assets.find_many(
                where={"assetTagId": {"in": created_asset_tag_ids}},
                select={"id": True, "assetTagId": True, "createdAt": True}
            )
            
            # Check for existing history logs
            existing_history_logs = await prisma.assetshistorylogs.find_many(
                where={
                    "assetId": {"in": [str(a.id) for a in created_assets]},
                    "eventType": "added"
                },
                select={"assetId": True}
            )
            
            existing_asset_ids = {log.assetId for log in existing_history_logs}
            assets_needing_history = [a for a in created_assets if str(a.id) not in existing_asset_ids]
            
            if assets_needing_history:
                history_logs_to_create = [
                    {
                        "assetId": str(asset.id),
                        "eventType": "added",
                        "actionBy": user_name,
                        "eventDate": asset.createdAt,
                    }
                    for asset in assets_needing_history
                ]
                await prisma.assetshistorylogs.create_many(
                    data=history_logs_to_create,
                    skip_duplicates=True
                )
            
            # Process audit history records
            assets_with_audit = [
                asset for asset in assets
                if asset.get("assetTagId") and asset.get("assetTagId") not in existing_asset_tags
                and (asset.get("lastAuditDate") or asset.get("lastAuditType") or asset.get("lastAuditor"))
            ]
            
            if assets_with_audit:
                audit_asset_tag_ids = [asset.get("assetTagId") for asset in assets_with_audit]
                audit_created_assets = await prisma.assets.find_many(
                    where={"assetTagId": {"in": audit_asset_tag_ids}},
                    select={"id": True, "assetTagId": True}
                )
                
                asset_id_map = {a.assetTagId: str(a.id) for a in audit_created_assets}
                
                audit_records_to_create = []
                for asset in assets_with_audit:
                    asset_id = asset_id_map.get(asset.get("assetTagId"))
                    if not asset_id:
                        continue
                    
                    audit_date = None
                    if asset.get("lastAuditDate"):
                        if isinstance(asset.get("lastAuditDate"), datetime):
                            audit_date = asset.get("lastAuditDate")
                        else:
                            audit_date = parse_date(asset.get("lastAuditDate")) or datetime.now()
                    else:
                        audit_date = datetime.now()
                    
                    if not asset.get("lastAuditDate") and not asset.get("lastAuditType"):
                        continue
                    
                    audit_records_to_create.append({
                        "assetId": asset_id,
                        "auditType": asset.get("lastAuditType") or "Imported Audit",
                        "auditDate": audit_date,
                        "auditor": asset.get("lastAuditor"),
                        "status": "Completed",
                        "notes": "Imported from Excel file",
                    })
                
                if audit_records_to_create:
                    await prisma.assetsaudithistory.create_many(
                        data=audit_records_to_create,
                        skip_duplicates=True
                    )
            
            # Process checkout records
            checkout_statuses = ["checked out", "checked-out", "checkedout", "in use"]
            checkout_assets = [
                asset_data for asset_data in assets_to_create
                if asset_data.get("status") and asset_data.get("status", "").lower().strip() in checkout_statuses
            ]
            
            if checkout_assets:
                checkout_asset_tag_ids = [a["assetTagId"] for a in checkout_assets]
                checkout_created_assets = await prisma.assets.find_many(
                    where={"assetTagId": {"in": checkout_asset_tag_ids}},
                    select={"id": True, "assetTagId": True}
                )
                
                checkout_asset_id_map = {a.assetTagId: str(a.id) for a in checkout_created_assets}
                
                checkout_records_to_create = []
                for asset_data in checkout_assets:
                    asset_id = checkout_asset_id_map.get(asset_data["assetTagId"])
                    if not asset_id:
                        continue
                    
                    checkout_date = asset_data.get("deliveryDate") or asset_data.get("purchaseDate") or datetime.now()
                    if not isinstance(checkout_date, datetime):
                        checkout_date = parse_date(checkout_date) or datetime.now()
                    
                    checkout_records_to_create.append({
                        "assetId": asset_id,
                        "employeeUserId": None,
                        "checkoutDate": checkout_date,
                        "expectedReturnDate": None,
                    })
                
                if checkout_records_to_create:
                    await prisma.assetscheckout.create_many(
                        data=checkout_records_to_create,
                        skip_duplicates=True
                    )
        
        # Prepare results
        results = []
        for asset in assets:
            asset_tag_id = asset.get("assetTagId")
            if not asset_tag_id:
                continue
            
            if asset_tag_id in existing_asset_tags:
                if asset_tag_id in deleted_asset_tags:
                    results.append({"asset": asset_tag_id, "action": "skipped", "reason": "Asset exists in trash"})
                else:
                    results.append({"asset": asset_tag_id, "action": "skipped", "reason": "Duplicate asset tag"})
            else:
                results.append({"asset": asset_tag_id, "action": "created"})
        
        return {
            "message": "Assets imported successfully",
            "results": results,
            "summary": {
                "total": len(assets),
                "created": created_count,
                "skipped": len(assets) - created_count
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error importing assets: {error_message}", exc_info=True)
        
        if "Unique constraint" in error_message or "duplicate" in error_message.lower():
            raise HTTPException(status_code=400, detail="Duplicate asset detected. Please ensure all Asset Tag IDs are unique.")
        if "Foreign key constraint" in error_message:
            raise HTTPException(status_code=400, detail="Invalid category or subcategory reference. Please check your category names.")
        if "Invalid value" in error_message:
            raise HTTPException(status_code=400, detail="Invalid data format. Please check your Excel file columns match the expected format.")
        
        raise HTTPException(
            status_code=500,
            detail="Failed to import assets. Please ensure your Excel file has the correct column headers and data format."
        )


# Helper functions for documents
def get_supabase_admin_client() -> Client:
    """Get Supabase admin client for storage operations"""
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_service_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase service role key not configured"
        )
    return create_client(SUPABASE_URL, supabase_service_key)


async def check_permission(user_id: str, permission: str) -> bool:
    """Check if user has a specific permission"""
    try:
        asset_user = await prisma.assetuser.find_unique(
            where={"userId": user_id}
        )
        if not asset_user or not asset_user.isActive:
            return False
        return getattr(asset_user, permission, False)
    except Exception:
        return False


# Document routes - must be registered before /{asset_id} route
@router.get("/documents")
async def get_documents(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=1000),
    auth: dict = Depends(verify_auth)
):
    """Get all documents with pagination"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Allow viewing documents without canManageMedia permission
        # Users can view but actions (upload/delete) are controlled by client-side checks
        
        supabase_admin = get_supabase_admin_client()
        
        # Helper function to recursively list all files in a folder
        async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
            all_files: List[Dict[str, Any]] = []
            
            try:
                response = supabase_admin.storage.from_(bucket).list(folder, {
                    "limit": 1000
                })
                
                if not response:
                    return all_files
                
                for item in response:
                    item_path = f"{folder}/{item['name']}" if folder else item['name']
                    
                    # Check if it's a folder by checking if id is missing
                    is_folder = item.get('id') is None
                    
                    if is_folder:
                        # It's a folder, recursively list files inside
                        sub_files = await list_all_files(bucket, item_path)
                        all_files.extend(sub_files)
                    else:
                        # Include all files
                        all_files.append({
                            "name": item['name'],
                            "id": item.get('id') or item_path,
                            "created_at": item.get('created_at') or datetime.now().isoformat(),
                            "path": item_path,
                            "metadata": item.get('metadata', {})
                        })
            except Exception as e:
                logger.warning(f"Error listing files from {bucket}/{folder}: {e}")
            
            return all_files
        
        # Fetch fresh file list
        # List files from assets_documents folder in assets bucket
        assets_files = await list_all_files('assets', 'assets_documents')
        
        # List files from assets_documents folder in file-history bucket
        file_history_files = await list_all_files('file-history', 'assets/assets_documents')
        
        # Combine files from both buckets
        combined_files: List[Dict[str, Any]] = []
        
        # Add files from assets bucket (only from assets_documents folder)
        for file in assets_files:
            if file['path'].startswith('assets_documents/') and not file['path'].startswith('assets_images/'):
                combined_files.append({
                    **file,
                    "bucket": 'assets',
                })
        
        # Add files from file-history bucket (only from assets/assets_documents folder)
        for file in file_history_files:
            if file['path'].startswith('assets/assets_documents/') and not file['path'].startswith('assets/assets_images/'):
                combined_files.append({
                    **file,
                    "bucket": 'file-history',
                })
        
        # Sort by created_at descending
        combined_files.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Paginate
        total_count = len(combined_files)
        skip = (page - 1) * pageSize
        paginated_files = combined_files[skip:skip + pageSize]
        
        # Prepare all file data and extract URLs/assetTagIds
        file_data = []
        for file in paginated_files:
            try:
                url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
                public_url = url_data if isinstance(url_data, str) else url_data.get('publicUrl', '') if isinstance(url_data, dict) else ''
                
                # Extract full filename and assetTagId
                path_parts = file['path'].split('/')
                actual_file_name = path_parts[-1]
                
                # Extract assetTagId - filename format is: assetTagId-timestamp.ext
                file_name_without_ext = actual_file_name.rsplit('.', 1)[0] if '.' in actual_file_name else actual_file_name
                import re
                timestamp_match = re.search(r'-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$', file_name_without_ext)
                asset_tag_id = file_name_without_ext[:timestamp_match.start()] if timestamp_match else file_name_without_ext.split('-')[0] if '-' in file_name_without_ext else file_name_without_ext
                
                # If the extracted assetTagId is "documents", it's a standalone document upload
                if asset_tag_id == 'documents':
                    asset_tag_id = ''
                
                file_data.append({
                    "file": file,
                    "publicUrl": public_url,
                    "assetTagId": asset_tag_id,
                    "actualFileName": actual_file_name,
                    "storageSize": file.get('metadata', {}).get('size') if isinstance(file.get('metadata'), dict) else None,
                    "storageMimeType": file.get('metadata', {}).get('mimetype') if isinstance(file.get('metadata'), dict) else None,
                })
            except Exception as e:
                logger.warning(f"Error processing file {file.get('path', 'unknown')}: {e}")
                continue
        
        # Batch query: Get all linked documents in a single query
        all_public_urls = [fd['publicUrl'] for fd in file_data if fd['publicUrl']]
        
        # Normalize URLs by removing query parameters and fragments
        def normalize_url(url: str) -> str:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            except:
                return url.split('?')[0].split('#')[0]
        
        normalized_public_urls = [normalize_url(url) for url in all_public_urls]
        
        # Build OR conditions for URL matching
        url_conditions = []
        if all_public_urls:
            url_conditions.append({"documentUrl": {"in": all_public_urls}})
        if normalized_public_urls:
            url_conditions.append({"documentUrl": {"in": normalized_public_urls}})
        
        # Add filename-based matches
        for fd in file_data:
            if fd['actualFileName']:
                url_conditions.append({"documentUrl": {"contains": fd['actualFileName']}})
        
        # Query linked documents
        # Note: Prisma Python doesn't support 'select', so we fetch all fields
        all_linked_documents = []
        if url_conditions:
            try:
                all_linked_documents_raw = await prisma.assetsdocument.find_many(
                    where={"OR": url_conditions}
                )
                # Extract only the fields we need
                all_linked_documents = [
                    {
                        "assetTagId": doc.assetTagId,
                        "documentUrl": doc.documentUrl,
                        "documentType": doc.documentType,
                        "documentSize": doc.documentSize,
                        "fileName": doc.fileName,
                        "mimeType": doc.mimeType,
                    }
                    for doc in all_linked_documents_raw
                ]
            except Exception as e:
                logger.warning(f"Error querying linked documents: {e}")
        
        # Create maps for quick lookup
        document_url_to_asset_tag_ids: Dict[str, set] = {}
        asset_tag_id_to_document_urls: Dict[str, set] = {}
        document_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        
        for doc in all_linked_documents:
            if not doc.get('assetTagId') or not doc.get('documentUrl'):
                continue
            
            doc_url = doc['documentUrl']
            
            # Store metadata
            document_url_to_metadata[doc_url] = {
                "documentType": doc.get('documentType'),
                "documentSize": doc.get('documentSize'),
                "fileName": doc.get('fileName'),
                "mimeType": doc.get('mimeType'),
            }
            
            # Map by documentUrl
            if doc_url not in document_url_to_asset_tag_ids:
                document_url_to_asset_tag_ids[doc_url] = set()
            document_url_to_asset_tag_ids[doc_url].add(doc['assetTagId'])
            
            # Map by assetTagId
            if doc['assetTagId'] not in asset_tag_id_to_document_urls:
                asset_tag_id_to_document_urls[doc['assetTagId']] = set()
            asset_tag_id_to_document_urls[doc['assetTagId']].add(doc_url)
        
        # Also check for filename matches
        for fd in file_data:
            asset_tag_id = fd['assetTagId']
            actual_file_name = fd['actualFileName']
            if not asset_tag_id:
                continue
            
            matching_urls = [
                url for url in asset_tag_id_to_document_urls.get(asset_tag_id, [])
                if actual_file_name.lower() in url.lower()
            ]
            
            for url in matching_urls:
                if url not in document_url_to_asset_tag_ids:
                    document_url_to_asset_tag_ids[url] = set()
                document_url_to_asset_tag_ids[url].add(asset_tag_id)
        
        # Get all unique asset tag IDs that are linked
        all_linked_asset_tag_ids = set()
        for fd in file_data:
            tag_ids = document_url_to_asset_tag_ids.get(fd['publicUrl'], set())
            all_linked_asset_tag_ids.update(tag_ids)
        
        # Batch query: Get all asset deletion status
        linked_assets_info_map: Dict[str, bool] = {}
        if all_linked_asset_tag_ids:
            try:
                assets = await prisma.assets.find_many(
                    where={"assetTagId": {"in": list(all_linked_asset_tag_ids)}},
                    select={"assetTagId": True, "isDeleted": True}
                )
                for asset in assets:
                    linked_assets_info_map[asset['assetTagId']] = asset.get('isDeleted', False)
            except Exception as e:
                logger.warning(f"Error querying assets: {e}")
        
        # Calculate total storage used from ALL files (not just paginated)
        documents_files = [f for f in combined_files if f['path'].startswith('assets_documents/') or f['path'].startswith('assets/assets_documents/')]
        all_file_data = []
        for file in documents_files:
            try:
                url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
                public_url = url_data if isinstance(url_data, str) else url_data.get('publicUrl', '') if isinstance(url_data, dict) else ''
                all_file_data.append({
                    "publicUrl": public_url,
                    "storageSize": file.get('metadata', {}).get('size') if isinstance(file.get('metadata'), dict) else None,
                })
            except Exception:
                continue
        
        # Get metadata for all files from database
        all_file_public_urls = [fd['publicUrl'] for fd in all_file_data if fd['publicUrl']]
        all_db_documents = []
        if all_file_public_urls:
            try:
                # Note: Prisma Python doesn't support 'select', so we fetch all fields
                all_db_documents_raw = await prisma.assetsdocument.find_many(
                    where={"documentUrl": {"in": all_file_public_urls}}
                )
                # Extract only the fields we need
                all_db_documents = [
                    {
                        "documentUrl": doc.documentUrl,
                        "documentType": doc.documentType,
                        "documentSize": doc.documentSize,
                        "fileName": doc.fileName,
                        "mimeType": doc.mimeType,
                    }
                    for doc in all_db_documents_raw
                ]
            except Exception as e:
                logger.warning(f"Error querying all documents for storage calculation: {e}")
        
        all_document_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        for doc in all_db_documents:
            if doc.get('documentUrl'):
                all_document_url_to_metadata[doc['documentUrl']] = {
                    "documentType": doc.get('documentType'),
                    "documentSize": doc.get('documentSize'),
                    "fileName": doc.get('fileName'),
                    "mimeType": doc.get('mimeType'),
                }
        
        # Calculate total storage used
        total_storage_used = sum(
            (fd.get('storageSize') or all_document_url_to_metadata.get(fd['publicUrl'], {}).get('documentSize') or 0)
            for fd in all_file_data
        )
        
        # Build the response (only for paginated documents)
        documents = []
        for fd in file_data:
            # Find matching database documentUrl
            normalized_public_url = normalize_url(fd['publicUrl'])
            matching_db_document_url = None
            
            for db_document_url in document_url_to_asset_tag_ids.keys():
                normalized_db_url = normalize_url(db_document_url)
                if db_document_url == fd['publicUrl'] or normalized_db_url == normalized_public_url:
                    matching_db_document_url = db_document_url
                    break
            
            # Also check by filename if no exact match found
            if not matching_db_document_url and fd['actualFileName']:
                for db_document_url in document_url_to_asset_tag_ids.keys():
                    if fd['actualFileName'].lower() in db_document_url.lower():
                        matching_db_document_url = db_document_url
                        break
            
            # Use database documentUrl if found, otherwise use storage publicUrl
            final_document_url = matching_db_document_url or fd['publicUrl']
            
            # Get linked asset tag IDs
            linked_asset_tag_ids = list(
                document_url_to_asset_tag_ids.get(final_document_url, set()) or
                document_url_to_asset_tag_ids.get(fd['publicUrl'], set()) or
                []
            )
            linked_assets_info = [
                {"assetTagId": tag_id, "isDeleted": linked_assets_info_map.get(tag_id, False)}
                for tag_id in linked_asset_tag_ids
            ]
            has_deleted_asset = any(info['isDeleted'] for info in linked_assets_info)
            
            # Get metadata
            db_metadata = document_url_to_metadata.get(final_document_url) or document_url_to_metadata.get(fd['publicUrl']) or {}
            
            # Prefer storage metadata over database metadata
            document_type = db_metadata.get('documentType')
            document_size = fd.get('storageSize') or db_metadata.get('documentSize')
            file_name = db_metadata.get('fileName') or fd['actualFileName']
            mime_type = fd.get('storageMimeType') or db_metadata.get('mimeType')
            
            documents.append({
                "id": fd['file'].get('id') or fd['file']['path'],
                "documentUrl": final_document_url,
                "assetTagId": fd['assetTagId'],
                "fileName": file_name,
                "createdAt": fd['file'].get('created_at') or datetime.now().isoformat(),
                "isLinked": len(linked_asset_tag_ids) > 0,
                "linkedAssetTagId": linked_asset_tag_ids[0] if linked_asset_tag_ids else None,
                "linkedAssetTagIds": linked_asset_tag_ids,
                "linkedAssetsInfo": linked_assets_info,
                "assetIsDeleted": has_deleted_asset,
                "documentType": document_type,
                "documentSize": document_size,
                "mimeType": mime_type,
            })
        
        return {
            "documents": documents,
            "pagination": {
                "total": total_count,
                "page": page,
                "pageSize": pageSize,
                "totalPages": (total_count + pageSize - 1) // pageSize if pageSize > 0 else 0,
            },
            "storage": {
                "used": total_storage_used,
                "limit": 5 * 1024 * 1024,  # 5MB limit (temporary)
            },
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch documents")


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    documentType: Optional[str] = Form(None),
    auth: dict = Depends(verify_auth)
):
    """Upload a document to storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check media permission
        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Validate file type
        allowed_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
            'application/rtf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
        ]
        allowed_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
        
        file_extension = '.' + file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        
        if file.content_type not in allowed_types and file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP files are allowed."
            )
        
        # Validate file size (max 5MB per file)
        max_file_size = 5 * 1024 * 1024  # 5MB
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > max_file_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )
        
        # Check storage limit (5MB total - temporary)
        storage_limit = 5 * 1024 * 1024  # 5MB limit
        
        supabase_admin = get_supabase_admin_client()
        
        try:
            # List all files to calculate total size
            async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
                all_files: List[Dict[str, Any]] = []
                try:
                    response = supabase_admin.storage.from_(bucket).list(folder, {"limit": 1000})
                    if not response:
                        return all_files
                    for item in response:
                        item_path = f"{folder}/{item['name']}" if folder else item['name']
                        is_folder = item.get('id') is None
                        if is_folder:
                            sub_files = await list_all_files(bucket, item_path)
                            all_files.extend(sub_files)
                        else:
                            all_files.append({
                                "metadata": item.get('metadata', {}),
                                "path": item_path
                            })
                except Exception:
                    pass
                return all_files
            
            assets_files = await list_all_files('assets', '')
            file_history_files = await list_all_files('file-history', 'assets')
            
            # Calculate storage from files
            current_storage_used = 0
            for f in assets_files + file_history_files:
                if isinstance(f.get('metadata'), dict) and f['metadata'].get('size'):
                    current_storage_used += f['metadata']['size']
            
            # Also check database for documents that might have size info
            try:
                db_documents = await prisma.assetsdocument.find_many(
                    select={"documentUrl": True, "documentSize": True}
                )
                storage_sizes = {f.get('metadata', {}).get('size') for f in assets_files + file_history_files if isinstance(f.get('metadata'), dict)}
                for doc in db_documents:
                    if doc.get('documentSize') and doc['documentSize'] not in storage_sizes:
                        current_storage_used += doc['documentSize']
            except Exception:
                pass
            
            if current_storage_used + file_size > storage_limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"Storage limit exceeded. Current usage: {current_storage_used / (1024 * 1024):.2f}MB / {storage_limit / (1024 * 1024):.2f}MB"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Could not check storage limit: {e}")
        
        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        sanitized_extension = file_extension[1:] if file_extension.startswith('.') else file_extension
        file_name = f"documents-{timestamp}.{sanitized_extension}"
        file_path = f"assets_documents/{file_name}"
        
        # Upload to Supabase storage
        public_url = None
        final_file_path = file_path
        
        try:
            # Try assets bucket first
            response = supabase_admin.storage.from_('assets').upload(
                file_path,
                file_content,
                file_options={"content-type": file.content_type or "application/octet-stream"}
            )
            
            if response:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data if isinstance(url_data, str) else (url_data.get('publicUrl', '') if isinstance(url_data, dict) else '')
        except Exception as upload_error:
            # If assets bucket doesn't exist, try file-history bucket
            error_msg = str(upload_error).lower()
            if 'bucket not found' in error_msg or 'not found' in error_msg:
                try:
                    response = supabase_admin.storage.from_('file-history').upload(
                        file_path,
                        file_content,
                        file_options={"content-type": file.content_type or "application/octet-stream"}
                    )
                    if response:
                        url_data = supabase_admin.storage.from_('file-history').get_public_url(file_path)
                        public_url = url_data if isinstance(url_data, str) else (url_data.get('publicUrl', '') if isinstance(url_data, dict) else '')
                except Exception as fallback_error:
                    logger.error(f"Storage upload error: {fallback_error}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload document to storage: {fallback_error}"
                    )
            else:
                logger.error(f"Storage upload error: {upload_error}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload document to storage: {upload_error}"
                )
        
        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded document"
            )
        
        # Create database record for the document
        asset_tag_id = 'STANDALONE'
        
        try:
            document_record = await prisma.assetsdocument.create(
                data={
                    "assetTagId": asset_tag_id,
                    "documentUrl": public_url,
                    "documentType": documentType,
                    "documentSize": file_size,
                    "fileName": file.filename,
                    "mimeType": file.content_type,
                }
            )
            
            return {
                "id": str(document_record.id),
                "filePath": final_file_path,
                "fileName": file_name,
                "fileSize": file_size,
                "mimeType": file.content_type,
                "publicUrl": public_url,
                "documentType": documentType,
                "assetTagId": asset_tag_id,
            }
        except Exception as db_error:
            logger.error(f"Error creating document record in database: {db_error}")
            # Even if database insert fails, the file is already uploaded to storage
            return {
                "error": "Document uploaded to storage but failed to save to database",
                "details": str(db_error),
                "filePath": final_file_path,
                "fileName": file_name,
                "fileSize": file_size,
                "mimeType": file.content_type,
                "publicUrl": public_url,
                "documentType": documentType,
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload document")


@router.get("/documents/bulk")
async def get_bulk_asset_documents(
    assetTagIds: str = Query(..., description="Comma-separated list of asset tag IDs"),
    auth: dict = Depends(verify_auth)
):
    """Get documents for multiple asset tag IDs"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")

        if not assetTagIds:
            raise HTTPException(status_code=400, detail="assetTagIds parameter is required")

        # Parse comma-separated asset tag IDs
        asset_tag_ids = [id.strip() for id in assetTagIds.split(',') if id.strip()]

        if len(asset_tag_ids) == 0:
            return []

        # Fetch documents for all assets
        documents = await prisma.assetsdocument.find_many(
            where={"assetTagId": {"in": asset_tag_ids}},
            order={"createdAt": "desc"}
        )

        # Group documents by assetTagId
        documents_by_asset_tag = {}
        for doc in documents:
            asset_tag_id = str(doc.assetTagId)
            if asset_tag_id not in documents_by_asset_tag:
                documents_by_asset_tag[asset_tag_id] = []
            document_url = doc.documentUrl if doc.documentUrl else None
            if document_url:
                documents_by_asset_tag[asset_tag_id].append({
                    "documentUrl": document_url
                })

        # Return array of { assetTagId, documents: [{ documentUrl }] }
        result = [
            {
                "assetTagId": asset_tag_id,
                "documents": documents_by_asset_tag.get(asset_tag_id, [])
            }
            for asset_tag_id in asset_tag_ids
        ]

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bulk asset documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset documents")


@router.get("/documents/{asset_tag_id}")
async def get_asset_documents(
    asset_tag_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get all documents for a specific asset by assetTagId"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check view permission
        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")
        
        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")
        
        # Fetch documents for the asset
        try:
            documents = await prisma.assetsdocument.find_many(
                where={
                    "assetTagId": asset_tag_id,
                },
                order={"createdAt": "desc"}
            )
        except Exception as db_error:
            error_str = str(db_error).lower()
            if 'p1001' in error_str or 'p2024' in error_str or 'connection' in error_str:
                raise HTTPException(
                    status_code=503,
                    detail="Database connection limit reached. Please try again in a moment."
                )
            raise
        
        return {"documents": documents}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset documents")


@router.delete("/documents/delete")
async def delete_document_by_url(
    documentUrl: str = Query(..., description="Document URL to delete"),
    auth: dict = Depends(verify_auth)
):
    """Delete document by URL - removes all links and optionally deletes from storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check media permission
        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")
        
        if not documentUrl:
            raise HTTPException(status_code=400, detail="Document URL is required")
        
        # Find all AssetsDocument records linked to this document URL
        try:
            linked_documents = await prisma.assetsdocument.find_many(
                where={
                    "documentUrl": documentUrl,
                }
            )
        except Exception as db_error:
            logger.error(f"Error finding linked documents: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to find linked documents")
        
        # Delete all database links for this document (if any exist)
        deleted_count = 0
        if linked_documents:
            try:
                result = await prisma.assetsdocument.delete_many(
                    where={
                        "documentUrl": documentUrl,
                    }
                )
                deleted_count = result
            except Exception as db_error:
                logger.error(f"Error deleting document links: {db_error}")
                raise HTTPException(status_code=500, detail="Failed to delete document links")
        
        # Delete the file from storage
        try:
            supabase_admin = get_supabase_admin_client()
            import re
            from urllib.parse import unquote
            
            # Decode URL-encoded characters
            decoded_url = unquote(documentUrl)
            
            # Extract bucket and path from URL
            url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
            if url_match:
                bucket = url_match.group(1)
                path = url_match.group(2)
                
                # Remove query parameters from path (e.g., ?t=timestamp)
                path = path.split('?')[0]
                
                # Remove URL-encoding from path
                path = unquote(path)
                
                logger.info(f"Attempting to delete document from storage: bucket={bucket}, path={path}")
                
                # Delete from storage
                delete_response = supabase_admin.storage.from_(bucket).remove([path])
                
                # Check for errors in response
                if delete_response:
                    if isinstance(delete_response, dict) and delete_response.get('error'):
                        logger.error(f"Failed to delete document from storage: {documentUrl}, Error: {delete_response['error']}")
                    else:
                        logger.info(f"Successfully deleted document from storage: {path}")
                else:
                    logger.warning(f"No response from storage deletion for: {path}")
            else:
                logger.warning(f"Could not parse storage URL: {documentUrl}")
        except Exception as storage_error:
            logger.error(f"Storage deletion error for {documentUrl}: {storage_error}", exc_info=True)
            # Continue even if storage deletion fails
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} link(s)" if deleted_count > 0 else "Deleted successfully",
            "deletedLinks": deleted_count,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete document")


@router.delete("/documents/delete/{document_id}")
async def delete_document_by_id(
    document_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete document by ID - removes from database only (keeps file in storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check edit permission
        has_permission = await check_permission(user_id, "canEditAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canEditAssets required")
        
        if not document_id:
            raise HTTPException(status_code=400, detail="Document ID is required")
        
        # Check if document exists first
        try:
            existing_document = await prisma.assetsdocument.find_unique(
                where={
                    "id": document_id,
                }
            )
        except Exception as db_error:
            logger.error(f"Error finding document: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to find document")
        
        if not existing_document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Delete document from database only (keep file in bucket)
        try:
            await prisma.assetsdocument.delete(
                where={
                    "id": document_id,
                }
            )
        except Exception as db_error:
            error_str = str(db_error).lower()
            if 'p2025' in error_str or 'record not found' in error_str:
                raise HTTPException(status_code=404, detail="Document not found")
            logger.error(f"Error deleting document: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to delete document")
        
        return {
            "success": True,
            "message": "Document deleted from database"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete document")


@router.delete("/documents/bulk-delete")
async def bulk_delete_documents(
    request: Dict[str, Any],
    auth: dict = Depends(verify_auth)
):
    """Bulk delete documents by URLs"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check media permission
        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")
        
        document_urls = request.get("documentUrls")
        
        if not document_urls or not isinstance(document_urls, list) or len(document_urls) == 0:
            raise HTTPException(
                status_code=400,
                detail="Document URLs array is required"
            )
        
        total_deleted_links = 0
        supabase_admin = get_supabase_admin_client()
        
        # Process each document URL
        for document_url in document_urls:
            # Find all AssetsDocument records linked to this document URL
            try:
                linked_documents = await prisma.assetsdocument.find_many(
                    where={
                        "documentUrl": document_url,
                    }
                )
            except Exception as db_error:
                logger.warning(f"Error finding linked documents for {document_url}: {db_error}")
                continue
            
            # Delete all database links for this document (if any exist)
            if linked_documents:
                try:
                    await prisma.assetsdocument.delete_many(
                        where={
                            "documentUrl": document_url,
                        }
                    )
                    total_deleted_links += len(linked_documents)
                except Exception as db_error:
                    logger.warning(f"Error deleting document links for {document_url}: {db_error}")
                    continue
            
            # Delete the file from storage
            try:
                import re
                from urllib.parse import unquote
                
                # Decode URL-encoded characters
                decoded_url = unquote(document_url)
                
                # Extract bucket and path from URL
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
                if url_match:
                    bucket = url_match.group(1)
                    path = url_match.group(2)
                    
                    # Remove query parameters from path (e.g., ?t=timestamp)
                    path = path.split('?')[0]
                    
                    # Remove URL-encoding from path
                    path = unquote(path)
                    
                    # Delete from storage
                    delete_response = supabase_admin.storage.from_(bucket).remove([path])
                    
                    # Check for errors in response
                    if delete_response:
                        if isinstance(delete_response, dict) and delete_response.get('error'):
                            logger.error(f"Failed to delete document from storage: {document_url}, Error: {delete_response['error']}")
                        else:
                            logger.info(f"Successfully deleted document from storage: {path}")
                    else:
                        logger.warning(f"No response from storage deletion for: {path}")
                else:
                    logger.warning(f"Could not parse storage URL: {document_url}")
            except Exception as storage_error:
                logger.error(f"Storage deletion error for {document_url}: {storage_error}", exc_info=True)
                # Continue with other files even if one fails
        
        return {
            "success": True,
            "message": f"Deleted {len(document_urls)} document(s){f' and removed {total_deleted_links} link(s)' if total_deleted_links > 0 else ''}",
            "deletedCount": len(document_urls),
            "deletedLinks": total_deleted_links,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to bulk delete documents")


@router.get("/images/bulk")
async def get_bulk_asset_images(
    assetTagIds: str = Query(..., description="Comma-separated list of asset tag IDs"),
    auth: dict = Depends(verify_auth)
):
    """Get images for multiple asset tag IDs"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")

        if not assetTagIds:
            raise HTTPException(status_code=400, detail="assetTagIds parameter is required")

        # Parse comma-separated asset tag IDs
        asset_tag_ids = [id.strip() for id in assetTagIds.split(',') if id.strip()]

        if len(asset_tag_ids) == 0:
            return []

        # Fetch images for all assets
        images = await prisma.assetsimage.find_many(
            where={"assetTagId": {"in": asset_tag_ids}},
            order={"createdAt": "desc"}
        )

        # Group images by assetTagId
        images_by_asset_tag = {}
        for img in images:
            asset_tag_id = img.assetTagId
            image_url = img.imageUrl
            if asset_tag_id not in images_by_asset_tag:
                images_by_asset_tag[asset_tag_id] = []
            if image_url:
                images_by_asset_tag[asset_tag_id].append(image_url)

        # Return array of { assetTagId, images: [{ imageUrl }] }
        result = [
            {
                "assetTagId": asset_tag_id,
                "images": [{"imageUrl": image_url} for image_url in images_by_asset_tag.get(asset_tag_id, [])]
            }
            for asset_tag_id in asset_tag_ids
        ]

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bulk asset images: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset images")


@router.get("/images/{asset_tag_id}")
async def get_asset_images(
    asset_tag_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get all images for a specific asset tag ID"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")

        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")

        images = await prisma.assetsimage.find_many(
            where={"assetTagId": asset_tag_id},
            order={"createdAt": "desc"}
        )

        return {"images": images}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset images: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset images")


@router.delete("/images/delete/{image_id}")
async def delete_image_by_id(
    image_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete an image record from the database by its ID (keeps file in storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canEditAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canEditAssets required")

        if not image_id:
            raise HTTPException(status_code=400, detail="Image ID is required")

        existing_image = await prisma.assetsimage.find_unique(
            where={"id": image_id}
        )

        if not existing_image:
            raise HTTPException(status_code=404, detail="Image not found")

        await prisma.assetsimage.delete(
            where={"id": image_id}
        )

        return {"success": True, "message": "Image deleted from database"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image by ID: {type(e).__name__}: {str(e)}", exc_info=True)
        if "P2025" in str(e):  # Prisma error for record not found
            raise HTTPException(status_code=404, detail="Image not found")
        raise HTTPException(status_code=500, detail="Failed to delete image")


@router.get("/media")
async def get_media(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=1000),
    auth: dict = Depends(verify_auth)
):
    """Get all media (images) with pagination from storage buckets"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Allow viewing media without canManageMedia permission
        # Users can view but actions (upload/delete) are controlled by client-side checks
        
        supabase_admin = get_supabase_admin_client()
        
        # Helper function to recursively list all files in a folder
        async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
            all_files: List[Dict[str, Any]] = []
            
            try:
                response = supabase_admin.storage.from_(bucket).list(folder, {
                    "limit": 1000
                })
                
                if not response:
                    return all_files
                
                for item in response:
                    item_path = f"{folder}/{item['name']}" if folder else item['name']
                    
                    # Check if it's a folder by checking if id is missing
                    is_folder = item.get('id') is None
                    
                    if is_folder:
                        # It's a folder, recursively list files inside
                        sub_files = await list_all_files(bucket, item_path)
                        all_files.extend(sub_files)
                    else:
                        # Include all files
                        all_files.append({
                            "name": item['name'],
                            "id": item.get('id') or item_path,
                            "created_at": item.get('created_at') or datetime.now().isoformat(),
                            "path": item_path,
                            "metadata": item.get('metadata', {})
                        })
            except Exception as e:
                logger.warning(f"Error listing files from {bucket}/{folder}: {e}")
            
            return all_files
        
        # Fetch fresh file list
        # List files from assets_images folder in assets bucket
        assets_files = await list_all_files('assets', 'assets_images')
        
        # List files from assets_images folder in file-history bucket
        file_history_files = await list_all_files('file-history', 'assets/assets_images')
        
        # Combine files from both buckets
        combined_files: List[Dict[str, Any]] = []
        
        # Add files from assets bucket (only from assets_images folder)
        # Filter by path to ensure we only get images, not documents from assets_documents
        for file in assets_files:
            # Ensure file is in assets_images folder and NOT in assets_documents folder
            if file['path'].startswith('assets_images/') and not file['path'].startswith('assets_documents/'):
                combined_files.append({
                    **file,
                    "bucket": 'assets',
                })
        
        # Add files from file-history bucket (only from assets/assets_images folder)
        # Filter by path to ensure we only get images, not documents from assets/assets_documents
        for file in file_history_files:
            # Ensure file is in assets/assets_images folder and NOT in assets/assets_documents folder
            if file['path'].startswith('assets/assets_images/') and not file['path'].startswith('assets/assets_documents/'):
                combined_files.append({
                    **file,
                    "bucket": 'file-history',
                })
        
        # Sort by created_at descending
        combined_files.sort(key=lambda x: datetime.fromisoformat(x['created_at'].replace('Z', '+00:00')) if x.get('created_at') else datetime.min, reverse=True)
        
        # Paginate
        total_count = len(combined_files)
        skip = (page - 1) * pageSize
        paginated_files = combined_files[skip:skip + pageSize]
        
        # Prepare file data and extract URLs/assetTagIds
        file_data = []
        for file in paginated_files:
            url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
            public_url = url_data.get('publicUrl', '') if isinstance(url_data, dict) else str(url_data)
            
            # Extract full filename and assetTagId
            path_parts = file['path'].split('/')
            actual_file_name = path_parts[-1]
            
            # Extract assetTagId - filename format is: assetTagId-timestamp.ext
            file_name_without_ext = actual_file_name.rsplit('.', 1)[0] if '.' in actual_file_name else actual_file_name
            # Try to match pattern: assetTagId-YYYY-MM-DDTHH-MM-SS-sssZ
            import re
            timestamp_match = re.search(r'-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$', file_name_without_ext)
            asset_tag_id = file_name_without_ext[:timestamp_match.start()] if timestamp_match else file_name_without_ext.split('-')[0] if '-' in file_name_without_ext else file_name_without_ext
            
            # If the extracted assetTagId is "media", it's a standalone media upload, not linked to an asset
            if asset_tag_id == 'media':
                asset_tag_id = ''
            
            file_data.append({
                "file": file,
                "publicUrl": public_url,
                "assetTagId": asset_tag_id,
                "actualFileName": actual_file_name,
                "storageSize": file.get('metadata', {}).get('size'),
                "storageMimeType": file.get('metadata', {}).get('mimetype'),
            })
        
        # Batch query: Get all linked images in a single query
        all_public_urls = [fd['publicUrl'] for fd in file_data if fd['publicUrl']]
        
        # Normalize URLs by removing query parameters and fragments for better matching
        def normalize_url(url: str) -> str:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            except:
                return url.split('?')[0].split('#')[0]
        
        normalized_public_urls = [normalize_url(url) for url in all_public_urls]
        
        # Build OR conditions for URL matching
        url_conditions = []
        if all_public_urls:
            url_conditions.append({"imageUrl": {"in": all_public_urls}})
        if normalized_public_urls:
            url_conditions.append({"imageUrl": {"in": normalized_public_urls}})
        
        # Add filename-based matches
        for fd in file_data:
            if fd['actualFileName']:
                url_conditions.append({"imageUrl": {"contains": fd['actualFileName']}})
        
        # Query linked images - Note: Prisma Python doesn't support 'select', so we fetch all fields
        all_linked_images_raw = []
        if url_conditions:
            try:
                all_linked_images_raw = await prisma.assetsimage.find_many(
                    where={"OR": url_conditions} if url_conditions else {}
                )
            except Exception as e:
                logger.warning(f"Error querying linked images: {e}")
        
        # Extract only the fields we need
        all_linked_images = [
            {
                "assetTagId": img.assetTagId,
                "imageUrl": img.imageUrl,
                "imageType": img.imageType,
                "imageSize": img.imageSize,
            }
            for img in all_linked_images_raw
        ]
        
        # Create maps for quick lookup
        image_url_to_asset_tag_ids: Dict[str, set] = {}
        image_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        
        for img in all_linked_images:
            if not img.get('assetTagId') or not img.get('imageUrl'):
                continue
            
            img_url = img['imageUrl']
            normalized_img_url = normalize_url(img_url)
            
            # Store metadata
            image_url_to_metadata[img_url] = {
                "imageType": img.get('imageType'),
                "imageSize": img.get('imageSize'),
            }
            
            # Map by exact URL
            if img_url not in image_url_to_asset_tag_ids:
                image_url_to_asset_tag_ids[img_url] = set()
            image_url_to_asset_tag_ids[img_url].add(img['assetTagId'])
            
            # Also map normalized URL
            if normalized_img_url not in image_url_to_asset_tag_ids:
                image_url_to_asset_tag_ids[normalized_img_url] = set()
            image_url_to_asset_tag_ids[normalized_img_url].add(img['assetTagId'])
        
        # Match database URLs to storage publicUrls
        for fd in file_data:
            public_url = fd['publicUrl']
            normalized_public_url = normalize_url(public_url)
            
            # Check if any database URL matches this publicUrl
            for img in all_linked_images:
                if not img.get('assetTagId') or not img.get('imageUrl'):
                    continue
                
                normalized_db_url = normalize_url(img['imageUrl'])
                
                # Match by exact URL or normalized URL
                if img['imageUrl'] == public_url or normalized_db_url == normalized_public_url:
                    if public_url not in image_url_to_asset_tag_ids:
                        image_url_to_asset_tag_ids[public_url] = set()
                    image_url_to_asset_tag_ids[public_url].add(img['assetTagId'])
        
        # Also check for filename matches
        for fd in file_data:
            public_url = fd['publicUrl']
            actual_file_name = fd['actualFileName']
            if not actual_file_name:
                continue
            
            normalized_public_url = normalize_url(public_url)
            file_name_lower = actual_file_name.lower()
            
            for img in all_linked_images:
                if not img.get('assetTagId') or not img.get('imageUrl'):
                    continue
                
                normalized_db_url = normalize_url(img['imageUrl'])
                db_url_lower = img['imageUrl'].lower()
                
                # Check multiple matching strategies
                if (normalized_db_url == normalized_public_url or 
                    file_name_lower in db_url_lower or 
                    file_name_lower in normalized_public_url):
                    if public_url not in image_url_to_asset_tag_ids:
                        image_url_to_asset_tag_ids[public_url] = set()
                    image_url_to_asset_tag_ids[public_url].add(img['assetTagId'])
        
        # Get all unique asset tag IDs that are linked
        all_linked_asset_tag_ids = set()
        for fd in file_data:
            tag_ids = image_url_to_asset_tag_ids.get(fd['publicUrl'], set())
            all_linked_asset_tag_ids.update(tag_ids)
        
        # Batch query: Get all asset deletion status
        linked_assets_info_map = {}
        if all_linked_asset_tag_ids:
            try:
                assets = await prisma.assets.find_many(
                    where={"assetTagId": {"in": list(all_linked_asset_tag_ids)}}
                )
                for asset in assets:
                    linked_assets_info_map[asset.assetTagId] = asset.isDeleted or False
            except Exception as e:
                logger.warning(f"Error querying linked assets: {e}")
        
        # Calculate total storage used from ALL files (not just paginated)
        images_files = [f for f in combined_files if f['path'].startswith('assets_images/') or f['path'].startswith('assets/assets_images/')]
        all_file_data = []
        for file in images_files:
            try:
                url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
                public_url = url_data.get('publicUrl', '') if isinstance(url_data, dict) else str(url_data)
                all_file_data.append({
                    "publicUrl": public_url,
                    "storageSize": file.get('metadata', {}).get('size') if isinstance(file.get('metadata'), dict) else None,
                })
            except Exception:
                continue
        
        # Get metadata for all files from database
        all_file_public_urls = [fd['publicUrl'] for fd in all_file_data if fd['publicUrl']]
        all_db_images = []
        if all_file_public_urls:
            try:
                # Normalize URLs for matching
                normalized_all_urls = [normalize_url(url) for url in all_file_public_urls]
                
                # Build OR conditions for URL matching
                all_url_conditions = []
                if all_file_public_urls:
                    all_url_conditions.append({"imageUrl": {"in": all_file_public_urls}})
                if normalized_all_urls:
                    all_url_conditions.append({"imageUrl": {"in": normalized_all_urls}})
                
                # Query all images from database - Note: Prisma Python doesn't support 'select', so we fetch all fields
                all_db_images_raw = await prisma.assetsimage.find_many(
                    where={"OR": all_url_conditions} if all_url_conditions else {}
                )
                # Extract only the fields we need
                all_db_images = [
                    {
                        "imageUrl": img.imageUrl,
                        "imageSize": img.imageSize,
                    }
                    for img in all_db_images_raw
                ]
            except Exception as e:
                logger.warning(f"Error querying all images for storage calculation: {e}")
        
        all_image_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        for img in all_db_images:
            if img.get('imageUrl'):
                all_image_url_to_metadata[img['imageUrl']] = {
                    "imageSize": img.get('imageSize'),
                }
        
        # Calculate total storage used - use storage size OR database size as fallback
        total_storage_used = sum(
            (fd.get('storageSize') or all_image_url_to_metadata.get(fd['publicUrl'], {}).get('imageSize') or 0)
            for fd in all_file_data
        )
        
        # Build the response
        images = []
        for fd in file_data:
            public_url = fd['publicUrl']
            normalized_public_url = normalize_url(public_url)
            
            # Find matching database imageUrl
            matching_db_image_url = None
            for db_image_url in image_url_to_asset_tag_ids.keys():
                normalized_db_url = normalize_url(db_image_url)
                if db_image_url == public_url or normalized_db_url == normalized_public_url:
                    matching_db_image_url = db_image_url
                    break
            
            # Also check by filename if no exact match
            if not matching_db_image_url and fd['actualFileName']:
                for db_image_url in image_url_to_asset_tag_ids.keys():
                    if fd['actualFileName'].lower() in db_image_url.lower():
                        matching_db_image_url = db_image_url
                        break
            
            # Use database imageUrl if found, otherwise use storage publicUrl
            final_image_url = matching_db_image_url or public_url
            
            # Get linked asset tag IDs
            linked_asset_tag_ids = list(image_url_to_asset_tag_ids.get(final_image_url, image_url_to_asset_tag_ids.get(public_url, set())))
            linked_assets_info = [
                {"assetTagId": tag_id, "isDeleted": linked_assets_info_map.get(tag_id, False)}
                for tag_id in linked_asset_tag_ids
            ]
            has_deleted_asset = any(info['isDeleted'] for info in linked_assets_info)
            
            # Get metadata
            db_metadata = image_url_to_metadata.get(final_image_url, image_url_to_metadata.get(public_url, {}))
            image_type = fd['storageMimeType'] or db_metadata.get('imageType')
            image_size = fd['storageSize'] or db_metadata.get('imageSize')
            
            images.append({
                "id": fd['file'].get('id') or fd['file']['path'],
                "imageUrl": final_image_url,
                "assetTagId": fd['assetTagId'],
                "fileName": fd['actualFileName'],
                "createdAt": fd['file'].get('created_at') or datetime.now().isoformat(),
                "isLinked": len(linked_asset_tag_ids) > 0,
                "linkedAssetTagId": linked_asset_tag_ids[0] if linked_asset_tag_ids else None,
                "linkedAssetTagIds": linked_asset_tag_ids,
                "linkedAssetsInfo": linked_assets_info,
                "assetIsDeleted": has_deleted_asset,
                "imageType": image_type,
                "imageSize": image_size,
            })
        
        return {
            "images": images,
            "pagination": {
                "total": total_count,
                "page": page,
                "pageSize": pageSize,
                "totalPages": (total_count + pageSize - 1) // pageSize,
            },
            "storage": {
                "used": total_storage_used,
                "limit": 5 * 1024 * 1024,  # 5MB limit
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch media")


@router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    auth: dict = Depends(verify_auth)
):
    """Upload a media file (image) to storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
            )

        # Read file content
        contents = await file.read()
        file_size = len(contents)

        # Validate file size (max 5MB per file)
        max_file_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_file_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )

        # Check storage limit (5GB total)
        storage_limit = 5 * 1024 * 1024 * 1024  # 5GB
        supabase_admin = get_supabase_admin_client()

        # Calculate current storage used (simplified - just check if we're close to limit)
        # In production, you might want to cache this or calculate more efficiently
        try:
            # List files to calculate storage
            async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
                all_files: List[Dict[str, Any]] = []
                try:
                    response = supabase_admin.storage.from_(bucket).list(folder, {"limit": 1000})
                    if not response:
                        return all_files
                    for item in response:
                        item_path = f"{folder}/{item['name']}" if folder else item['name']
                        is_folder = item.get('id') is None
                        if is_folder:
                            sub_files = await list_all_files(bucket, item_path)
                            all_files.extend(sub_files)
                        else:
                            all_files.append({
                                "metadata": item.get('metadata', {}),
                                "path": item_path
                            })
                except Exception as e:
                    logger.warning(f"Error listing files from {bucket}/{folder}: {e}")
                return all_files

            assets_files = await list_all_files('assets', '')
            file_history_files = await list_all_files('file-history', 'assets')

            current_storage_used = 0
            for f in assets_files + file_history_files:
                if f.get('metadata', {}).get('size'):
                    current_storage_used += f['metadata']['size']

            if current_storage_used + file_size > storage_limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"Storage limit exceeded. Current usage: {(current_storage_used / (1024 * 1024)):.2f}MB / {(storage_limit / (1024 * 1024)):.2f}MB"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Could not check storage limit: {e}")

        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        sanitized_extension = file_extension.lower()
        file_name = f"media-{timestamp}.{sanitized_extension}"
        file_path = f"assets_images/{file_name}"

        # Upload to Supabase storage
        public_url = None
        final_file_path = file_path

        try:
            upload_response = supabase_admin.storage.from_('assets').upload(
                file_path,
                contents,
                file_options={"content-type": file.content_type, "upsert": "false"}
            )
            if upload_response and isinstance(upload_response, dict) and upload_response.get('error'):
                # Try file-history bucket as fallback
                fallback_path = file_path
                fallback_response = supabase_admin.storage.from_('file-history').upload(
                    fallback_path,
                    contents,
                    file_options={"content-type": file.content_type, "upsert": "false"}
                )
                if fallback_response and isinstance(fallback_response, dict) and fallback_response.get('error'):
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload image to storage: {fallback_response.get('error')}"
                    )
                url_data = supabase_admin.storage.from_('file-history').get_public_url(fallback_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
                final_file_path = fallback_path
            else:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
        except Exception as upload_error:
            logger.error(f"Storage upload error: {upload_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload image to storage: {str(upload_error)}"
            )

        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded image"
            )

        return {
            "filePath": final_file_path,
            "fileName": file_name,
            "fileSize": file_size,
            "mimeType": file.content_type,
            "publicUrl": public_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload media")


@router.delete("/media/delete")
async def delete_media(
    imageUrl: str = Query(...),
    auth: dict = Depends(verify_auth)
):
    """Delete a media file by its URL (removes database links and optionally the file from storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        if not imageUrl:
            raise HTTPException(status_code=400, detail="Image URL is required")

        # Find all AssetsImage records linked to this image URL
        linked_images = await prisma.assetsimage.find_many(
            where={"imageUrl": imageUrl}
        )

        # Delete all database links for this image (if any exist)
        if linked_images:
            await prisma.assetsimage.delete_many(
                where={"imageUrl": imageUrl}
            )

        # Delete the file from storage
        try:
            supabase_admin = get_supabase_admin_client()
            import re
            from urllib.parse import unquote, urlparse
            
            # Decode URL-encoded characters
            decoded_url = unquote(imageUrl)
            
            # Extract bucket and path from URL
            # URLs are like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
            url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
            if url_match:
                bucket = url_match.group(1)
                path = url_match.group(2)
                
                # Remove query parameters from path (e.g., ?t=timestamp)
                path = path.split('?')[0]
                
                # Remove URL-encoding from path
                path = unquote(path)
                
                logger.info(f"Attempting to delete file from storage: bucket={bucket}, path={path}")
                
                # Delete from storage
                delete_response = supabase_admin.storage.from_(bucket).remove([path])
                
                # Check for errors in response
                if delete_response:
                    if isinstance(delete_response, dict):
                        if delete_response.get('error'):
                            logger.error(f"Failed to delete file from storage: {imageUrl}, Error: {delete_response['error']}")
                        else:
                            logger.info(f"Successfully deleted file from storage: {path}")
                    elif isinstance(delete_response, list):
                        # Supabase Python client might return a list
                        logger.info(f"Successfully deleted file from storage: {path}")
                    else:
                        logger.info(f"File deletion response: {delete_response}")
                else:
                    logger.warning(f"No response from storage deletion for: {path}")
            else:
                logger.warning(f"Could not parse storage URL: {imageUrl}")
        except Exception as storage_error:
            logger.error(f"Storage deletion error for {imageUrl}: {storage_error}", exc_info=True)

        return {
            "success": True,
            "message": f"Deleted {len(linked_images)} link(s) and attempted to delete file from storage",
            "deletedLinks": len(linked_images),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete media")


@router.delete("/media/bulk-delete")
async def bulk_delete_media(
    request: Dict[str, Any],
    auth: dict = Depends(verify_auth)
):
    """Bulk delete media files by URLs (removes database links and optionally files from storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        image_urls = request.get("imageUrls")
        if not image_urls or not isinstance(image_urls, list) or len(image_urls) == 0:
            raise HTTPException(
                status_code=400,
                detail="Image URLs array is required"
            )

        total_deleted_links = 0
        supabase_admin = get_supabase_admin_client()

        for image_url in image_urls:
            # Find all AssetsImage records linked to this image URL
            linked_images = await prisma.assetsimage.find_many(
                where={"imageUrl": image_url}
            )

            # Delete all database links for this image (if any exist)
            if linked_images:
                await prisma.assetsimage.delete_many(
                    where={"imageUrl": image_url}
                )
                total_deleted_links += len(linked_images)

            # Delete the file from storage
            try:
                import re
                from urllib.parse import unquote
                
                # Decode URL-encoded characters
                decoded_url = unquote(image_url)
                
                # Extract bucket and path from URL
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
                if url_match:
                    bucket = url_match.group(1)
                    path = url_match.group(2)
                    
                    # Remove query parameters from path (e.g., ?t=timestamp)
                    path = path.split('?')[0]
                    
                    # Remove URL-encoding from path
                    path = unquote(path)
                    
                    # Delete from storage
                    delete_response = supabase_admin.storage.from_(bucket).remove([path])
                    
                    # Check for errors in response
                    if delete_response:
                        if isinstance(delete_response, dict) and delete_response.get('error'):
                            logger.error(f"Failed to delete file from storage: {image_url}, Error: {delete_response['error']}")
                        else:
                            logger.info(f"Successfully deleted file from storage: {path}")
                    else:
                        logger.warning(f"No response from storage deletion for: {path}")
                else:
                    logger.warning(f"Could not parse storage URL: {image_url}")
            except Exception as storage_error:
                logger.error(f"Storage deletion error for {image_url}: {storage_error}", exc_info=True)

        return {
            "success": True,
            "message": f"Deleted {len(image_urls)} image(s){f' and removed {total_deleted_links} link(s)' if total_deleted_links > 0 else ''}",
            "deletedCount": len(image_urls),
            "deletedLinks": total_deleted_links,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to bulk delete media")


@router.post("/upload-document")
async def upload_document_to_asset(
    req: Request,
    auth: dict = Depends(verify_auth)
):
    """Upload or link a document to an asset"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canCreateAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canCreateAssets required")

        content_type = req.headers.get("content-type", "")
        file: Optional[UploadFile] = None
        asset_tag_id: Optional[str] = None
        document_url: Optional[str] = None
        link_existing = False
        document_type: Optional[str] = None

        # Check if request is JSON (for linking) or FormData (for uploading)
        if "application/json" in content_type:
            # Handle JSON body (linking existing document)
            body = await req.json()
            asset_tag_id = body.get("assetTagId")
            document_url = body.get("documentUrl")
            link_existing = body.get("linkExisting", False)
            document_type = body.get("documentType")
        else:
            # Handle FormData (file upload)
            form = await req.form()
            file = form.get("file")
            if file and isinstance(file, UploadFile):
                pass  # file is already UploadFile
            asset_tag_id = form.get("assetTagId")
            if isinstance(asset_tag_id, str):
                pass
            else:
                asset_tag_id = None
            document_type = form.get("documentType")
            if isinstance(document_type, str):
                pass
            else:
                document_type = None

        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")

        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"assetTagId": asset_tag_id}
        )

        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # If linking existing document
        if link_existing and document_url:
            # Extract document type and size from URL/storage
            url_extension = document_url.split('.')[-1].split('?')[0].lower() if '.' in document_url else None
            mime_type = None
            if url_extension:
                mime_types = {
                    'pdf': 'application/pdf',
                    'doc': 'application/msword',
                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'xls': 'application/vnd.ms-excel',
                    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'txt': 'text/plain',
                    'csv': 'text/csv',
                    'rtf': 'application/rtf',
                }
                mime_type = mime_types.get(url_extension)

            # Try to get file size from storage
            document_size = None
            try:
                supabase_admin = get_supabase_admin_client()
                import re
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', document_url)
                if url_match:
                    bucket = url_match.group(1)
                    full_path = url_match.group(2)
                    path_parts = full_path.split('/')
                    file_name = path_parts[-1]
                    folder_path = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''

                    file_list = supabase_admin.storage.from_(bucket).list(folder_path, {"limit": 1000})
                    if file_list:
                        for f in file_list:
                            if f.get('name') == file_name and f.get('metadata', {}).get('size'):
                                document_size = f['metadata']['size']
                                break
            except Exception as e:
                logger.warning(f"Could not fetch file size from storage: {e}")

            # Extract filename from URL
            url_parts = document_url.split('/')
            file_name = url_parts[-1].split('?')[0] if url_parts else None

            # Create document record
            document_record = await prisma.assetsdocument.create(
                data={
                    "assetTagId": asset_tag_id,
                    "documentUrl": document_url,
                    "documentType": document_type,
                    "documentSize": document_size,
                    "fileName": file_name,
                    "mimeType": mime_type,
                }
            )

            return {
                "id": str(document_record.id),
                "assetTagId": document_record.assetTagId,
                "documentUrl": document_record.documentUrl,
                "publicUrl": document_url,
            }

        # Handle file upload
        if not file:
            raise HTTPException(status_code=400, detail="File is required for upload")

        # Validate file type
        allowed_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
            'application/rtf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
        ]
        allowed_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
        file_extension = '.' + (file.filename.split('.')[-1] if '.' in file.filename else '').lower()

        if file.content_type not in allowed_types and file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP files are allowed."
            )

        # Validate file size
        contents = await file.read()
        file_size = len(contents)
        max_file_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_file_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )

        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        sanitized_extension = file_extension[1:] if file_extension.startswith('.') else 'pdf'
        file_name = f"{asset_tag_id}-{timestamp}.{sanitized_extension}"
        file_path = f"assets_documents/{file_name}"

        # Upload to Supabase storage
        supabase_admin = get_supabase_admin_client()
        public_url = None
        final_file_path = file_path

        try:
            upload_response = supabase_admin.storage.from_('assets').upload(
                file_path,
                contents,
                file_options={"content-type": file.content_type, "upsert": "false"}
            )
            if upload_response and isinstance(upload_response, dict) and upload_response.get('error'):
                # Try file-history bucket as fallback
                fallback_path = f"assets/{file_path}"
                fallback_response = supabase_admin.storage.from_('file-history').upload(
                    fallback_path,
                    contents,
                    file_options={"content-type": file.content_type, "upsert": "false"}
                )
                if fallback_response and isinstance(fallback_response, dict) and fallback_response.get('error'):
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload document to storage: {fallback_response.get('error')}"
                    )
                url_data = supabase_admin.storage.from_('file-history').get_public_url(fallback_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
                final_file_path = fallback_path
            else:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
        except Exception as upload_error:
            logger.error(f"Storage upload error: {upload_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload document to storage: {str(upload_error)}"
            )

        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded document"
            )

        # Save document record to database
        document_record = await prisma.assetsdocument.create(
            data={
                "assetTagId": asset_tag_id,
                "documentUrl": public_url,
                "documentType": document_type,
                "documentSize": file_size,
                "fileName": file.filename,
                "mimeType": file.content_type,
            }
        )

        return {
            "id": str(document_record.id),
            "assetTagId": document_record.assetTagId,
            "documentUrl": document_record.documentUrl,
            "publicUrl": public_url,
            "filePath": final_file_path,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading/linking document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload/link document")


@router.post("/upload-image")
async def upload_image_to_asset(
    req: Request,
    auth: dict = Depends(verify_auth)
):
    """Upload or link an image to an asset"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canCreateAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canCreateAssets required")

        content_type = req.headers.get("content-type", "")
        file: Optional[UploadFile] = None
        asset_tag_id: Optional[str] = None
        image_url: Optional[str] = None
        link_existing = False

        # Check if request is JSON (for linking) or FormData (for uploading)
        if "application/json" in content_type:
            # Handle JSON body (linking existing image)
            body = await req.json()
            asset_tag_id = body.get("assetTagId")
            image_url = body.get("imageUrl")
            link_existing = body.get("linkExisting", False)
        else:
            # Handle FormData (file upload)
            form = await req.form()
            file = form.get("file")
            if file and isinstance(file, UploadFile):
                pass  # file is already UploadFile
            asset_tag_id = form.get("assetTagId")
            if isinstance(asset_tag_id, str):
                pass
            else:
                asset_tag_id = None

        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")

        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"assetTagId": asset_tag_id}
        )

        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # If linking existing image
        if link_existing and image_url:
            # Extract image type from URL
            url_extension = image_url.split('.')[-1].split('?')[0].lower() if '.' in image_url else None
            image_type = f"image/{url_extension}" if url_extension else None
            if image_type and url_extension == 'jpg':
                image_type = 'image/jpeg'

            # Try to get file size from storage
            image_size = None
            try:
                supabase_admin = get_supabase_admin_client()
                import re
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', image_url)
                if url_match:
                    bucket = url_match.group(1)
                    full_path = url_match.group(2)
                    path_parts = full_path.split('/')
                    file_name = path_parts[-1]
                    folder_path = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''

                    file_list = supabase_admin.storage.from_(bucket).list(folder_path, {"limit": 1000})
                    if file_list:
                        for f in file_list:
                            if f.get('name') == file_name and f.get('metadata', {}).get('size'):
                                image_size = f['metadata']['size']
                                break
            except Exception as e:
                logger.warning(f"Could not fetch file size from storage: {e}")

            # Create image record
            image_record = await prisma.assetsimage.create(
                data={
                    "assetTagId": asset_tag_id,
                    "imageUrl": image_url,
                    "imageType": image_type,
                    "imageSize": image_size,
                }
            )

            return {
                "id": str(image_record.id),
                "assetTagId": image_record.assetTagId,
                "imageUrl": image_record.imageUrl,
                "publicUrl": image_url,
            }

        # Handle file upload
        if not file:
            raise HTTPException(status_code=400, detail="File is required for upload")

        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
            )

        # Validate file size
        contents = await file.read()
        file_size = len(contents)
        max_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )

        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        sanitized_extension = file_extension.lower()
        file_name = f"{asset_tag_id}-{timestamp}.{sanitized_extension}"
        file_path = f"assets_images/{file_name}"

        # Upload to Supabase storage
        supabase_admin = get_supabase_admin_client()
        public_url = None
        final_file_path = file_path

        try:
            upload_response = supabase_admin.storage.from_('assets').upload(
                file_path,
                contents,
                file_options={"content-type": file.content_type, "upsert": "false"}
            )
            if upload_response and isinstance(upload_response, dict) and upload_response.get('error'):
                # Try file-history bucket as fallback
                fallback_path = f"assets/{file_path}"
                fallback_response = supabase_admin.storage.from_('file-history').upload(
                    fallback_path,
                    contents,
                    file_options={"content-type": file.content_type, "upsert": "false"}
                )
                if fallback_response and isinstance(fallback_response, dict) and fallback_response.get('error'):
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload image to storage: {fallback_response.get('error')}"
                    )
                url_data = supabase_admin.storage.from_('file-history').get_public_url(fallback_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
                final_file_path = fallback_path
            else:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
        except Exception as upload_error:
            logger.error(f"Storage upload error: {upload_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload image to storage: {str(upload_error)}"
            )

        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded image"
            )

        # Save image record to database
        image_record = await prisma.assetsimage.create(
            data={
                "assetTagId": asset_tag_id,
                "imageUrl": public_url,
                "imageType": file.content_type,
                "imageSize": file_size,
            }
        )

        return {
            "id": str(image_record.id),
            "assetTagId": image_record.assetTagId,
            "imageUrl": image_record.imageUrl,
            "filePath": final_file_path,
            "fileName": file_name,
            "fileSize": file_size,
            "mimeType": file.content_type,
            "publicUrl": public_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload image")


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get a single asset by ID"""
    try:
        # Find the asset
        asset_data = await prisma.assets.find_unique(
            where={"id": asset_id},
            include={
                "category": True,
                "subCategory": True,
                "checkouts": {
                    "include": {
                        "employeeUser": True,
                        "checkins": True
                    }
                },
                "leases": {
                    "include": {
                        "returns": True
                    }
                },
                "auditHistory": True
            }
        )
        
        if not asset_data:
            raise HTTPException(status_code=404, detail=f"Asset with ID {asset_id} not found")
        
        # Get image count
        image_counts = {}
        try:
            # Count images for this asset
            image_count = await prisma.assetsimage.count(
                where={"assetTagId": asset_data.assetTagId}
            )
            image_counts[asset_data.assetTagId] = image_count
        except Exception as e:
            logger.warning(f"Error counting images: {e}")
            image_counts[asset_data.assetTagId] = 0
        
        # Format category info
        category_info = None
        if asset_data.category:
            category_info = CategoryInfo(
                id=str(asset_data.category.id),
                name=str(asset_data.category.name)
            )
        
        # Format subcategory info
        sub_category_info = None
        if asset_data.subCategory:
            sub_category_info = SubCategoryInfo(
                id=str(asset_data.subCategory.id),
                name=str(asset_data.subCategory.name)
            )
        
        # Format checkouts
        checkouts_list = []
        if asset_data.checkouts:
            for checkout in asset_data.checkouts:
                employee_info = None
                if checkout.employeeUser:
                    employee_info = EmployeeInfo(
                        id=str(checkout.employeeUser.id),
                        name=str(checkout.employeeUser.name),
                        email=str(checkout.employeeUser.email),
                        department=checkout.employeeUser.department
                    )
                
                checkouts_list.append(CheckoutInfo(
                    id=str(checkout.id),
                    checkoutDate=checkout.checkoutDate,
                    expectedReturnDate=checkout.expectedReturnDate,
                    employeeUser=employee_info
                ))
        
        # Format leases
        leases_list = []
        if asset_data.leases:
            for lease in asset_data.leases:
                leases_list.append(LeaseInfo(
                    id=str(lease.id),
                    leaseStartDate=lease.leaseStartDate,
                    leaseEndDate=lease.leaseEndDate,
                    lessee=lease.lessee
                ))
        
        # Format audit history
        audit_history_list = []
        if asset_data.auditHistory:
            # Sort by auditDate descending and take only the first 5
            sorted_audits = sorted(
                asset_data.auditHistory,
                key=lambda x: x.auditDate if x.auditDate else datetime.min,
                reverse=True
            )[:5]
            for audit in sorted_audits:
                audit_history_list.append(AuditHistoryInfo(
                    id=str(audit.id),
                    auditDate=audit.auditDate,
                    auditType=audit.auditType,
                    auditor=audit.auditor
                ))
        
        asset = Asset(
            id=str(asset_data.id),
            assetTagId=str(asset_data.assetTagId),
            description=str(asset_data.description),
            purchasedFrom=asset_data.purchasedFrom,
            purchaseDate=asset_data.purchaseDate,
            brand=asset_data.brand,
            cost=asset_data.cost,
            model=asset_data.model,
            serialNo=asset_data.serialNo,
            additionalInformation=asset_data.additionalInformation,
            xeroAssetNo=asset_data.xeroAssetNo,
            owner=asset_data.owner,
            pbiNumber=asset_data.pbiNumber,
            status=asset_data.status,
            issuedTo=asset_data.issuedTo,
            poNumber=asset_data.poNumber,
            paymentVoucherNumber=asset_data.paymentVoucherNumber,
            assetType=asset_data.assetType,
            deliveryDate=asset_data.deliveryDate,
            unaccountedInventory=asset_data.unaccountedInventory,
            remarks=asset_data.remarks,
            qr=asset_data.qr,
            oldAssetTag=asset_data.oldAssetTag,
            depreciableAsset=asset_data.depreciableAsset,
            depreciableCost=asset_data.depreciableCost,
            salvageValue=asset_data.salvageValue,
            assetLifeMonths=asset_data.assetLifeMonths,
            depreciationMethod=asset_data.depreciationMethod,
            dateAcquired=asset_data.dateAcquired,
            categoryId=asset_data.categoryId,
            category=category_info,
            subCategoryId=asset_data.subCategoryId,
            subCategory=sub_category_info,
            department=asset_data.department,
            site=asset_data.site,
            location=asset_data.location,
            createdAt=asset_data.createdAt,
            updatedAt=asset_data.updatedAt,
            deletedAt=asset_data.deletedAt,
            isDeleted=asset_data.isDeleted,
            checkouts=checkouts_list if checkouts_list else None,
            leases=leases_list if leases_list else None,
            auditHistory=audit_history_list if audit_history_list else None,
            imagesCount=image_counts.get(asset_data.assetTagId, 0)
        )
        
        return AssetResponse(asset=asset)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset")

@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    asset_data: AssetCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new asset"""
    try:
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        # Parse dates
        purchase_date = parse_date(asset_data.purchaseDate)
        delivery_date = parse_date(asset_data.deliveryDate)
        date_acquired = parse_date(asset_data.dateAcquired)
        
        # Create asset in transaction
        async with prisma.tx() as transaction:
            # Create the asset
            new_asset_data = await transaction.assets.create(
                data={
                    "assetTagId": asset_data.assetTagId,
                    "description": asset_data.description,
                    "purchasedFrom": asset_data.purchasedFrom,
                    "purchaseDate": purchase_date,
                    "brand": asset_data.brand,
                    "cost": Decimal(str(asset_data.cost)) if asset_data.cost else None,
                    "model": asset_data.model,
                    "serialNo": asset_data.serialNo,
                    "additionalInformation": asset_data.additionalInformation,
                    "xeroAssetNo": asset_data.xeroAssetNo,
                    "owner": asset_data.owner,
                    "pbiNumber": asset_data.pbiNumber,
                    "status": asset_data.status or "Available",
                    "issuedTo": asset_data.issuedTo,
                    "poNumber": asset_data.poNumber,
                    "paymentVoucherNumber": asset_data.paymentVoucherNumber,
                    "assetType": asset_data.assetType,
                    "deliveryDate": delivery_date,
                    "unaccountedInventory": asset_data.unaccountedInventory or False,
                    "remarks": asset_data.remarks,
                    "qr": asset_data.qr,
                    "oldAssetTag": asset_data.oldAssetTag,
                    "depreciableAsset": asset_data.depreciableAsset or False,
                    "depreciableCost": Decimal(str(asset_data.depreciableCost)) if asset_data.depreciableCost else None,
                    "salvageValue": Decimal(str(asset_data.salvageValue)) if asset_data.salvageValue else None,
                    "assetLifeMonths": asset_data.assetLifeMonths,
                    "depreciationMethod": asset_data.depreciationMethod,
                    "dateAcquired": date_acquired,
                    "categoryId": asset_data.categoryId,
                    "subCategoryId": asset_data.subCategoryId,
                    "department": asset_data.department,
                    "site": asset_data.site,
                    "location": asset_data.location
                },
                include={
                    "category": True,
                    "subCategory": True,
                    "checkouts": {
                        "include": {
                            "employeeUser": True
                        }
                    }
                }
            )
            
            # Create history log for asset creation
            await transaction.assetshistorylogs.create(
                data={
                    "assetId": new_asset_data.id,
                    "eventType": "added",
                    "actionBy": user_name
                }
            )
        
        # Convert to Asset model
        category_info = None
        if new_asset_data.category:
            category_info = CategoryInfo(
                id=str(new_asset_data.category.id),
                name=str(new_asset_data.category.name)
            )
        
        sub_category_info = None
        if new_asset_data.subCategory:
            sub_category_info = SubCategoryInfo(
                id=str(new_asset_data.subCategory.id),
                name=str(new_asset_data.subCategory.name)
            )
        
        checkouts_list = []
        if new_asset_data.checkouts:
            # Sort by checkoutDate descending and take only the first one
            sorted_checkouts = sorted(
                new_asset_data.checkouts,
                key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min,
                reverse=True
            )[:1]
            for checkout in sorted_checkouts:
                employee_info = None
                if checkout.employeeUser:
                    employee_info = EmployeeInfo(
                        id=str(checkout.employeeUser.id),
                        name=str(checkout.employeeUser.name),
                        email=str(checkout.employeeUser.email)
                    )
                checkouts_list.append(CheckoutInfo(
                    id=str(checkout.id),
                    checkoutDate=checkout.checkoutDate,
                    expectedReturnDate=checkout.expectedReturnDate,
                    employeeUser=employee_info
                ))
        
        asset = Asset(
            id=str(new_asset_data.id),
            assetTagId=str(new_asset_data.assetTagId),
            description=str(new_asset_data.description),
            purchasedFrom=new_asset_data.purchasedFrom,
            purchaseDate=new_asset_data.purchaseDate,
            brand=new_asset_data.brand,
            cost=new_asset_data.cost,
            model=new_asset_data.model,
            serialNo=new_asset_data.serialNo,
            additionalInformation=new_asset_data.additionalInformation,
            xeroAssetNo=new_asset_data.xeroAssetNo,
            owner=new_asset_data.owner,
            pbiNumber=new_asset_data.pbiNumber,
            status=new_asset_data.status,
            issuedTo=new_asset_data.issuedTo,
            poNumber=new_asset_data.poNumber,
            paymentVoucherNumber=new_asset_data.paymentVoucherNumber,
            assetType=new_asset_data.assetType,
            deliveryDate=new_asset_data.deliveryDate,
            unaccountedInventory=new_asset_data.unaccountedInventory,
            remarks=new_asset_data.remarks,
            qr=new_asset_data.qr,
            oldAssetTag=new_asset_data.oldAssetTag,
            depreciableAsset=new_asset_data.depreciableAsset,
            depreciableCost=new_asset_data.depreciableCost,
            salvageValue=new_asset_data.salvageValue,
            assetLifeMonths=new_asset_data.assetLifeMonths,
            depreciationMethod=new_asset_data.depreciationMethod,
            dateAcquired=new_asset_data.dateAcquired,
            categoryId=new_asset_data.categoryId,
            category=category_info,
            subCategoryId=new_asset_data.subCategoryId,
            subCategory=sub_category_info,
            department=new_asset_data.department,
            site=new_asset_data.site,
            location=new_asset_data.location,
            createdAt=new_asset_data.createdAt,
            updatedAt=new_asset_data.updatedAt,
            deletedAt=new_asset_data.deletedAt,
            isDeleted=new_asset_data.isDeleted,
            checkouts=checkouts_list if checkouts_list else None,
            imagesCount=0
        )
        
        return AssetResponse(asset=asset)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create asset")

@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: str,
    asset_data: AssetUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an existing asset"""
    try:
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        # Check if asset exists
        current_asset = await prisma.assets.find_unique(
            where={"id": asset_id}
        )
        
        if not current_asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Check if assetTagId is being changed and if it already exists
        if asset_data.assetTagId and asset_data.assetTagId != current_asset.assetTagId:
            existing_asset = await prisma.assets.find_first(
                where={
                    "assetTagId": asset_data.assetTagId,
                    "id": {"not": asset_id}
                }
            )
            if existing_asset:
                raise HTTPException(status_code=400, detail="Asset tag ID already exists")
        
        # Build update data - only include fields that are provided
        update_data: Dict[str, Any] = {}
        
        # Helper to add field if provided (not None)
        def add_if_provided(field_name: str, value: Any, transform=None):
            if value is not None:
                update_data[field_name] = transform(value) if transform else value
        
        # String fields
        add_if_provided("assetTagId", asset_data.assetTagId)
        add_if_provided("description", asset_data.description)
        add_if_provided("purchasedFrom", asset_data.purchasedFrom)
        add_if_provided("brand", asset_data.brand)
        add_if_provided("model", asset_data.model)
        add_if_provided("serialNo", asset_data.serialNo)
        add_if_provided("additionalInformation", asset_data.additionalInformation)
        add_if_provided("xeroAssetNo", asset_data.xeroAssetNo)
        add_if_provided("owner", asset_data.owner)
        add_if_provided("pbiNumber", asset_data.pbiNumber)
        add_if_provided("status", asset_data.status)
        add_if_provided("issuedTo", asset_data.issuedTo)
        add_if_provided("poNumber", asset_data.poNumber)
        add_if_provided("paymentVoucherNumber", asset_data.paymentVoucherNumber)
        add_if_provided("assetType", asset_data.assetType)
        add_if_provided("remarks", asset_data.remarks)
        add_if_provided("qr", asset_data.qr)
        add_if_provided("oldAssetTag", asset_data.oldAssetTag)
        add_if_provided("depreciationMethod", asset_data.depreciationMethod)
        add_if_provided("department", asset_data.department)
        add_if_provided("site", asset_data.site)
        add_if_provided("location", asset_data.location)
        add_if_provided("categoryId", asset_data.categoryId)
        add_if_provided("subCategoryId", asset_data.subCategoryId)
        
        # Numeric fields
        if asset_data.cost is not None:
            update_data["cost"] = Decimal(str(asset_data.cost)) if asset_data.cost else None
        if asset_data.depreciableCost is not None:
            update_data["depreciableCost"] = Decimal(str(asset_data.depreciableCost)) if asset_data.depreciableCost else None
        if asset_data.salvageValue is not None:
            update_data["salvageValue"] = Decimal(str(asset_data.salvageValue)) if asset_data.salvageValue else None
        if asset_data.assetLifeMonths is not None:
            update_data["assetLifeMonths"] = asset_data.assetLifeMonths
        
        # Boolean fields
        if asset_data.unaccountedInventory is not None:
            update_data["unaccountedInventory"] = asset_data.unaccountedInventory
        if asset_data.depreciableAsset is not None:
            update_data["depreciableAsset"] = asset_data.depreciableAsset
        
        # Date fields
        if asset_data.purchaseDate is not None:
            update_data["purchaseDate"] = parse_date(asset_data.purchaseDate)
        if asset_data.deliveryDate is not None:
            update_data["deliveryDate"] = parse_date(asset_data.deliveryDate)
        if asset_data.dateAcquired is not None:
            update_data["dateAcquired"] = parse_date(asset_data.dateAcquired)
        
        # Track changes for history logging
        history_logs = []
        date_fields = ["purchaseDate", "deliveryDate", "dateAcquired"]
        
        for field, new_value in update_data.items():
            old_value = getattr(current_asset, field, None)
            
            # Normalize for comparison
            if field in date_fields:
                old_date_str = old_value.strftime("%Y-%m-%d") if old_value else ""
                new_date_str = new_value.strftime("%Y-%m-%d") if new_value else ""
                if old_date_str != new_date_str:
                    history_logs.append({
                        "field": field,
                        "changeFrom": old_date_str,
                        "changeTo": new_date_str
                    })
            else:
                old_str = str(old_value) if old_value is not None else ""
                new_str = str(new_value) if new_value is not None else ""
                if old_str != new_str:
                    history_logs.append({
                        "field": field,
                        "changeFrom": old_str,
                        "changeTo": new_str
                    })
        
        # Update asset and create history logs in transaction
        async with prisma.tx() as transaction:
            # Update asset
            # Note: Prisma Python doesn't support 'order' inside 'include', so we'll sort in Python
            updated_asset_data = await transaction.assets.update(
                where={"id": asset_id},
                data=update_data,
                include={
                    "category": True,
                    "subCategory": True,
                    "checkouts": {
                        "include": {
                            "employeeUser": True
                        }
                    }
                }
            )
            
            # Create history logs for each changed field
            for log in history_logs:
                await transaction.assetshistorylogs.create(
                    data={
                        "assetId": asset_id,
                        "eventType": "edited",
                        "field": log["field"],
                        "changeFrom": log["changeFrom"],
                        "changeTo": log["changeTo"],
                        "actionBy": user_name
                    }
                )
        
        # Get image count
        image_count = await prisma.assetsimage.count(
            where={"assetTagId": updated_asset_data.assetTagId}
        )
        
        # Convert to Asset model
        category_info = None
        if updated_asset_data.category:
            category_info = CategoryInfo(
                id=str(updated_asset_data.category.id),
                name=str(updated_asset_data.category.name)
            )
        
        sub_category_info = None
        if updated_asset_data.subCategory:
            sub_category_info = SubCategoryInfo(
                id=str(updated_asset_data.subCategory.id),
                name=str(updated_asset_data.subCategory.name)
            )
        
        checkouts_list = []
        if updated_asset_data.checkouts:
            # Sort by checkoutDate descending (most recent first)
            # Note: Prisma Python doesn't support 'order' inside 'include', so we sort in Python
            sorted_checkouts = sorted(
                updated_asset_data.checkouts,
                key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min,
                reverse=True
            )
            for checkout in sorted_checkouts[:1]:
                employee_info = None
                if checkout.employeeUser:
                    employee_info = EmployeeInfo(
                        id=str(checkout.employeeUser.id),
                        name=str(checkout.employeeUser.name),
                        email=str(checkout.employeeUser.email)
                    )
                checkouts_list.append(CheckoutInfo(
                    id=str(checkout.id),
                    checkoutDate=checkout.checkoutDate,
                    expectedReturnDate=checkout.expectedReturnDate,
                    employeeUser=employee_info
                ))
        
        asset = Asset(
            id=str(updated_asset_data.id),
            assetTagId=str(updated_asset_data.assetTagId),
            description=str(updated_asset_data.description),
            purchasedFrom=updated_asset_data.purchasedFrom,
            purchaseDate=updated_asset_data.purchaseDate,
            brand=updated_asset_data.brand,
            cost=updated_asset_data.cost,
            model=updated_asset_data.model,
            serialNo=updated_asset_data.serialNo,
            additionalInformation=updated_asset_data.additionalInformation,
            xeroAssetNo=updated_asset_data.xeroAssetNo,
            owner=updated_asset_data.owner,
            pbiNumber=updated_asset_data.pbiNumber,
            status=updated_asset_data.status,
            issuedTo=updated_asset_data.issuedTo,
            poNumber=updated_asset_data.poNumber,
            paymentVoucherNumber=updated_asset_data.paymentVoucherNumber,
            assetType=updated_asset_data.assetType,
            deliveryDate=updated_asset_data.deliveryDate,
            unaccountedInventory=updated_asset_data.unaccountedInventory,
            remarks=updated_asset_data.remarks,
            qr=updated_asset_data.qr,
            oldAssetTag=updated_asset_data.oldAssetTag,
            depreciableAsset=updated_asset_data.depreciableAsset,
            depreciableCost=updated_asset_data.depreciableCost,
            salvageValue=updated_asset_data.salvageValue,
            assetLifeMonths=updated_asset_data.assetLifeMonths,
            depreciationMethod=updated_asset_data.depreciationMethod,
            dateAcquired=updated_asset_data.dateAcquired,
            categoryId=updated_asset_data.categoryId,
            category=category_info,
            subCategoryId=updated_asset_data.subCategoryId,
            subCategory=sub_category_info,
            department=updated_asset_data.department,
            site=updated_asset_data.site,
            location=updated_asset_data.location,
            createdAt=updated_asset_data.createdAt,
            updatedAt=updated_asset_data.updatedAt,
            deletedAt=updated_asset_data.deletedAt,
            isDeleted=updated_asset_data.isDeleted,
            checkouts=checkouts_list if checkouts_list else None,
            imagesCount=image_count
        )
        
        return AssetResponse(asset=asset)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update asset")

@router.delete("/{asset_id}", response_model=DeleteResponse)
async def delete_asset(
    asset_id: str,
    permanent: bool = Query(False, description="Permanently delete the asset"),
    auth: dict = Depends(verify_auth)
):
    """Delete an asset (soft delete by default, permanent if specified)"""
    try:
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        # Check if asset exists
        existing_asset = await prisma.assets.find_unique(
            where={"id": asset_id}
        )
        
        if not existing_asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        if permanent:
            # Permanent delete (hard delete)
            async with prisma.tx() as transaction:
                # Log history before deleting
                await transaction.assetshistorylogs.create(
                    data={
                        "assetId": asset_id,
                        "eventType": "deleted",
                        "actionBy": user_name
                    }
                )
                
                # Delete the asset
                await transaction.assets.delete(
                    where={"id": asset_id}
                )
            
            return DeleteResponse(
                success=True,
                message="Asset permanently deleted"
            )
        else:
            # Soft delete
            async with prisma.tx() as transaction:
                # Log history
                await transaction.assetshistorylogs.create(
                    data={
                        "assetId": asset_id,
                        "eventType": "deleted",
                        "actionBy": user_name
                    }
                )
                
                # Soft delete - set isDeleted and deletedAt
                await transaction.assets.update(
                    where={"id": asset_id},
                    data={
                        "deletedAt": datetime.now(),
                        "isDeleted": True
                    }
                )
            
            return DeleteResponse(
                success=True,
                message="Asset archived. It will be permanently deleted after 30 days."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete asset")


@router.delete("/history/{history_id}")
async def delete_history_log(
    history_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a history log record"""
    try:
        # Check if history log record exists
        history_log = await prisma.assetshistorylogs.find_unique(
            where={"id": history_id}
        )
        
        if not history_log:
            raise HTTPException(status_code=404, detail="History log record not found")
        
        # Delete the history log record
        await prisma.assetshistorylogs.delete(
            where={"id": history_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting history log record: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete history log record")


@router.patch("/{asset_id}/restore")
async def restore_asset(
    asset_id: str,
    auth: dict = Depends(verify_auth)
):
    """Restore a soft-deleted asset"""
    try:
        # Check if asset exists and is soft-deleted
        asset = await prisma.assets.find_first(
            where={
                "id": asset_id,
                "isDeleted": True
            }
        )
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found or not deleted")
        
        # Restore asset
        await prisma.assets.update(
            where={"id": asset_id},
            data={
                "deletedAt": None,
                "isDeleted": False
            }
        )
        
        return {"success": True, "message": "Asset restored successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to restore asset")


@router.post("/bulk-restore", response_model=BulkRestoreResponse)
async def bulk_restore_assets(
    request: BulkRestoreRequest,
    auth: dict = Depends(verify_auth)
):
    """Bulk restore multiple soft-deleted assets"""
    try:
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="Invalid request. Expected an array of asset IDs.")
        
        # Restore all assets in a transaction
        async with prisma.tx() as transaction:
            # Update all assets to restore them
            result = await transaction.assets.update_many(
                where={
                    "id": {"in": request.ids},
                    "isDeleted": True  # Only restore assets that are actually deleted
                },
                data={
                    "deletedAt": None,
                    "isDeleted": False
                }
            )
        
        return BulkRestoreResponse(
            success=True,
            restoredCount=result,
            message=f"{result} asset(s) restored successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk restoring assets: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to restore assets")


@router.delete("/trash/empty")
async def empty_trash(
    auth: dict = Depends(verify_auth)
):
    """Permanently delete all soft-deleted assets"""
    try:
        # Permanently delete all soft-deleted assets
        result = await prisma.assets.delete_many(
            where={
                "isDeleted": True
            }
        )
        
        return {
            "success": True,
            "deletedCount": result,
            "message": f"{result} asset(s) permanently deleted"
        }
    
    except Exception as e:
        logger.error(f"Error emptying trash: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to empty trash")


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_assets(
    request: BulkDeleteRequest,
    auth: dict = Depends(verify_auth)
):
    """Bulk delete multiple assets (soft delete or permanent)"""
    try:
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="Invalid request. Expected an array of asset IDs.")
        
        if request.permanent:
            # Permanent delete (hard delete)
            async with prisma.tx() as transaction:
                # Log history for each asset before deleting
                for asset_id in request.ids:
                    await transaction.assetshistorylogs.create(
                        data={
                            "assetId": asset_id,
                            "eventType": "deleted",
                            "actionBy": user_name
                        }
                    )
                
                # Delete all assets
                result = await transaction.assets.delete_many(
                    where={
                        "id": {"in": request.ids}
                    }
                )
            
            return BulkDeleteResponse(
                success=True,
                deletedCount=result,
                message=f"{result} asset(s) permanently deleted"
            )
        else:
            # Soft delete
            async with prisma.tx() as transaction:
                # Log history for each asset
                for asset_id in request.ids:
                    await transaction.assetshistorylogs.create(
                        data={
                            "assetId": asset_id,
                            "eventType": "deleted",
                            "actionBy": user_name
                        }
                    )
                
                # Soft delete - set isDeleted and deletedAt
                result = await transaction.assets.update_many(
                    where={
                        "id": {"in": request.ids}
                    },
                    data={
                        "deletedAt": datetime.now(),
                        "isDeleted": True
                    }
                )
            
            return BulkDeleteResponse(
                success=True,
                deletedCount=result,
                message=f"{result} asset(s) archived. They will be permanently deleted after 30 days."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting assets: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete assets")
