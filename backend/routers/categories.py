"""
Categories API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
import logging
from models.categories import (
    Category,
    SubCategory,
    CategoryCreate,
    CategoryUpdate,
    CategoriesResponse,
    CategoryResponse
)
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/categories", tags=["categories"])

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

@router.get("", response_model=CategoriesResponse)
async def get_categories(
    search: Optional[str] = Query(None),
    auth: dict = Depends(verify_auth)
):
    """Get all categories with their subcategories and optional search filter"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # GET endpoint is open - all authenticated users can view categories (needed for dropdowns)
        
        if search:
            categories_data = await prisma.category.find_many(
                where={
                    "name": {
                        "contains": search,
                        "mode": "insensitive"
                    }
                },
                include={
                    "subCategories": True
                },
                order={"name": "asc"}
            )
        else:
            categories_data = await prisma.category.find_many(
                include={
                    "subCategories": True
                },
                order={"name": "asc"}
            )
        
        categories = []
        for cat in categories_data:
            try:
                # Map subcategories
                subcategories = []
                if cat.subCategories:
                    for subcat in cat.subCategories:
                        subcategories.append(SubCategory(
                            id=str(subcat.id),
                            name=str(subcat.name),
                            description=subcat.description if subcat.description else None
                        ))
                
                category = Category(
                    id=str(cat.id),
                    name=str(cat.name),
                    description=cat.description if cat.description else None,
                    subCategories=subcategories,
                    createdAt=cat.createdAt,
                    updatedAt=cat.updatedAt
                )
                categories.append(category)
            except Exception as e:
                logger.error(f"Error creating Category model: {type(e).__name__}: {str(e)}", exc_info=True)
                continue
        
        return CategoriesResponse(categories=categories)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching categories: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch categories")

@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    category_data: CategoryCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new category"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to create categories
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create categories"
            )
        
        # Check if category with same name exists
        existing = await prisma.category.find_first(
            where={
                "name": {
                    "equals": category_data.name.strip(),
                    "mode": "insensitive"
                }
            }
        )
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A category with this name already exists"
            )
        
        # Create new category using Prisma
        new_category = await prisma.category.create(
            data={
                "name": category_data.name.strip(),
                "description": category_data.description.strip() if category_data.description else None
            },
            include={
                "subCategories": True
            }
        )
        
        # Map subcategories
        subcategories = []
        if new_category.subCategories:
            for subcat in new_category.subCategories:
                subcategories.append(SubCategory(
                    id=str(subcat.id),
                    name=str(subcat.name),
                    description=subcat.description if subcat.description else None
                ))
        
        category = Category(
            id=str(new_category.id),
            name=str(new_category.name),
            description=new_category.description if new_category.description else None,
            subCategories=subcategories,
            createdAt=new_category.createdAt,
            updatedAt=new_category.updatedAt
        )
        
        return CategoryResponse(category=category)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating category: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create category")

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    category_data: CategoryUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an existing category"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to update categories
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update categories"
            )
        
        # Check if category exists
        existing = await prisma.category.find_unique(
            where={"id": category_id},
            include={"subCategories": True}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if another category with same name exists
        duplicate = await prisma.category.find_first(
            where={
                "name": {
                    "equals": category_data.name.strip(),
                    "mode": "insensitive"
                },
                "id": {
                    "not": category_id
                }
            }
        )
        
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="A category with this name already exists"
            )
        
        # Update category using Prisma
        updated_category = await prisma.category.update(
            where={"id": category_id},
            data={
                "name": category_data.name.strip(),
                "description": category_data.description.strip() if category_data.description else None
            },
            include={
                "subCategories": True
            }
        )
        
        # Map subcategories
        subcategories = []
        if updated_category.subCategories:
            for subcat in updated_category.subCategories:
                subcategories.append(SubCategory(
                    id=str(subcat.id),
                    name=str(subcat.name),
                    description=subcat.description if subcat.description else None
                ))
        
        category = Category(
            id=str(updated_category.id),
            name=str(updated_category.name),
            description=updated_category.description if updated_category.description else None,
            subCategories=subcategories,
            createdAt=updated_category.createdAt,
            updatedAt=updated_category.updatedAt
        )
        
        return CategoryResponse(category=category)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating category: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update category")

@router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a category"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete categories
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete categories"
            )
        
        # Check if category exists
        category = await prisma.category.find_unique(
            where={"id": category_id}
        )
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if any assets use this category
        assets_count = await prisma.assets.count(
            where={
                "categoryId": category_id,
                "isDeleted": False
            },
            take=1
        )
        
        if assets_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete category with associated assets. Please reassign or delete assets first."
            )
        
        # Delete category using Prisma (subcategories will be cascade deleted)
        await prisma.category.delete(
            where={"id": category_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting category: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete category")

