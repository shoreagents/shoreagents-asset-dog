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
    AssetsResponse,
    AssetResponse,
    StatusesResponse,
    SummaryResponse,
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

