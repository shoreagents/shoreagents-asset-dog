"""
Assets API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from decimal import Decimal
import logging
import asyncio

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
    PaginationInfo,
    SummaryInfo,
    CategoryInfo,
    SubCategoryInfo,
    EmployeeInfo,
    CheckoutInfo,
    LeaseInfo,
    AuditHistoryInfo
)
from auth import verify_auth
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
    pageSize: int = Query(50, ge=1, le=1000),
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
        
        # Get total count and assets in parallel
        total_count, assets_data = await asyncio.gather(
            prisma.assets.count(where=where_clause),
            prisma.assets.find_many(
                where=where_clause,
                include={
                    "category": True,
                    "subCategory": True,
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
                    **({"maintenances": {
                        "include": {
                            "inventoryItems": {
                                "include": {
                                    "inventoryItem": True
                                }
                            }
                        }
                    }} if withMaintenance else {})
                },
                order=[{"createdAt": "desc"}, {"id": "desc"}],
                skip=skip,
                take=pageSize
            )
        )
        
        # Get image counts for all assets
        assets_with_image_count = []
        if assets_data:
            asset_tag_ids = [asset.assetTagId for asset in assets_data]
            # Note: groupBy might not be available in prisma-client-py, so we'll count manually
            image_counts = {}
            for asset_tag_id in asset_tag_ids:
                count = await prisma.assetsimage.count(
                    where={"assetTagId": asset_tag_id}
                )
                image_counts[asset_tag_id] = count
        
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
                if asset_data.checkouts:
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
                if asset_data.leases:
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
            updated_asset_data = await transaction.assets.update(
                where={"id": asset_id},
                data=update_data,
                include={
                    "category": True,
                    "subCategory": True,
                    "checkouts": {
                        "include": {
                            "employeeUser": True
                        },
                        "order": {"checkoutDate": "desc"},
                        "take": 1
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
            for checkout in updated_asset_data.checkouts[:1]:
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
