"""
Subcategories API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends, status
from typing import Optional
import logging
from models.categories import (
    SubCategory,
    SubCategoryCreate,
    SubCategoryUpdate,
    SubCategoriesResponse,
    SubCategoryResponse
)
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subcategories", tags=["subcategories"])

async def check_permission(user_id: str, permission: str) -> bool:
    """Check if user has a specific permission. Admins have all permissions."""
    try:
        asset_user = await prisma.assetuser.find_unique(
            where={"userId": user_id}
        )
        if not asset_user or not asset_user.isActive:
            return False
        
        # Admins have all permissions
        if asset_user.role == "admin":
            return True
        
        return getattr(asset_user, permission, False)
    except Exception:
        return False


@router.get("", response_model=SubCategoriesResponse)
async def get_subcategories(
    categoryId: Optional[str] = Query(None, description="Filter by category ID"),
    auth: dict = Depends(verify_auth)
):
    """Get subcategories, optionally filtered by category ID"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # GET endpoint is open - all authenticated users can view subcategories (needed for dropdowns)
        
        where_clause = {}
        if categoryId:
            where_clause["categoryId"] = categoryId
        
        subcategories_data = await prisma.subcategory.find_many(
            where=where_clause if where_clause else None,
            order={"name": "asc"}
        )
        
        subcategories = []
        for subcat in subcategories_data:
            try:
                subcategory = SubCategory(
                    id=str(subcat.id),
                    name=str(subcat.name),
                    description=subcat.description if subcat.description else None
                )
                subcategories.append(subcategory)
            except Exception as e:
                logger.error(f"Error creating SubCategory model: {type(e).__name__}: {str(e)}", exc_info=True)
                continue
        
        return SubCategoriesResponse(subcategories=subcategories)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching subcategories: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch subcategories")


@router.post("", response_model=SubCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_subcategory(
    subcategory_data: SubCategoryCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new subcategory"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to create subcategories
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create subcategories"
            )
        
        # Check if subcategory with same name exists in the same category
        existing = await prisma.subcategory.find_first(
            where={
                "name": {
                    "equals": subcategory_data.name.strip(),
                    "mode": "insensitive"
                },
                "categoryId": subcategory_data.categoryId
            }
        )
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A subcategory with this name already exists in this category"
            )
        
        # Create new subcategory using Prisma
        new_subcategory = await prisma.subcategory.create(
            data={
                "name": subcategory_data.name.strip(),
                "description": subcategory_data.description.strip() if subcategory_data.description else None,
                "categoryId": subcategory_data.categoryId
            },
            include={
                "category": True
            }
        )
        
        subcategory = SubCategory(
            id=str(new_subcategory.id),
            name=str(new_subcategory.name),
            description=new_subcategory.description if new_subcategory.description else None
        )
        
        return SubCategoryResponse(subcategory=subcategory)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating subcategory: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create subcategory")


@router.put("/{subcategory_id}", response_model=SubCategoryResponse)
async def update_subcategory(
    subcategory_id: str,
    subcategory_data: SubCategoryUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an existing subcategory"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to update subcategories
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update subcategories"
            )
        
        # Check if subcategory exists
        existing = await prisma.subcategory.find_unique(
            where={"id": subcategory_id},
            include={"category": True}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Subcategory not found")
        
        # Check if another subcategory with same name exists in the same category
        duplicate = await prisma.subcategory.find_first(
            where={
                "name": {
                    "equals": subcategory_data.name.strip(),
                    "mode": "insensitive"
                },
                "categoryId": subcategory_data.categoryId,
                "id": {
                    "not": subcategory_id
                }
            }
        )
        
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="A subcategory with this name already exists in this category"
            )
        
        # Update subcategory using Prisma
        updated_subcategory = await prisma.subcategory.update(
            where={"id": subcategory_id},
            data={
                "name": subcategory_data.name.strip(),
                "description": subcategory_data.description.strip() if subcategory_data.description else None,
                "categoryId": subcategory_data.categoryId
            },
            include={
                "category": True
            }
        )
        
        subcategory = SubCategory(
            id=str(updated_subcategory.id),
            name=str(updated_subcategory.name),
            description=updated_subcategory.description if updated_subcategory.description else None
        )
        
        return SubCategoryResponse(subcategory=subcategory)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating subcategory: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update subcategory")


@router.delete("/{subcategory_id}")
async def delete_subcategory(
    subcategory_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a subcategory"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete subcategories
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete subcategories"
            )
        
        # Check if subcategory exists
        subcategory = await prisma.subcategory.find_unique(
            where={"id": subcategory_id},
            include={
                "assets": True
            }
        )
        
        if not subcategory:
            raise HTTPException(status_code=404, detail="Subcategory not found")
        
        # Check if any assets use this subcategory
        if subcategory.assets and len(subcategory.assets) > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete subcategory with associated assets. Please reassign or delete assets first."
            )
        
        # Delete subcategory using Prisma
        await prisma.subcategory.delete(
            where={"id": subcategory_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting subcategory: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete subcategory")

