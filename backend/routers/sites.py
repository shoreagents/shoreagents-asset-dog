"""
Sites API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
import logging
from models.sites import (
    Site,
    SiteCreate,
    SiteUpdate,
    SitesResponse,
    SiteResponse
)
from auth import verify_auth
from database import prisma
from typing import List
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sites", tags=["sites"])

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

class BulkDeleteRequest(BaseModel):
    ids: List[str]

@router.get("", response_model=SitesResponse)
async def get_sites(
    search: Optional[str] = Query(None),
    auth: dict = Depends(verify_auth)
):
    """Get all sites with optional search filter"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # GET endpoint is open - all authenticated users can view sites (needed for dropdowns)
        
        if search:
            sites_data = await prisma.assetssite.find_many(
                where={
                    "name": {
                        "contains": search,
                        "mode": "insensitive"
                    }
                },
                order={"name": "asc"}
            )
        else:
            sites_data = await prisma.assetssite.find_many(
                order={"name": "asc"}
            )
        
        sites = [
            Site(
                id=site.id,
                name=site.name,
                description=site.description,
                createdAt=site.createdAt,
                updatedAt=site.updatedAt
            )
            for site in sites_data
        ]
        
        return SitesResponse(sites=sites)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sites: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sites")

@router.post("", response_model=SiteResponse, status_code=201)
async def create_site(
    site_data: SiteCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new site"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to create sites
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create sites"
            )
        
        # Check if site with same name exists
        existing = await prisma.assetssite.find_first(
            where={
                "name": {
                    "equals": site_data.name.strip(),
                    "mode": "insensitive"
                }
            }
        )
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A site with this name already exists"
            )
        
        # Create new site using Prisma
        new_site = await prisma.assetssite.create(
            data={
                "name": site_data.name.strip(),
                "description": site_data.description.strip() if site_data.description else None
            }
        )
        
        site = Site(
            id=new_site.id,
            name=new_site.name,
            description=new_site.description,
            createdAt=new_site.createdAt,
            updatedAt=new_site.updatedAt
        )
        
        return SiteResponse(site=site)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating site: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create site")

@router.put("/{site_id}", response_model=SiteResponse)
async def update_site(
    site_id: str,
    site_data: SiteUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an existing site"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to update sites
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update sites"
            )
        
        # Check if site exists
        existing = await prisma.assetssite.find_unique(
            where={"id": site_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Site not found")
        
        # Check if another site with same name exists
        duplicate = await prisma.assetssite.find_first(
            where={
                "name": {
                    "equals": site_data.name.strip(),
                    "mode": "insensitive"
                },
                "id": {
                    "not": site_id
                }
            }
        )
        
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="A site with this name already exists"
            )
        
        # Update site using Prisma
        updated_site = await prisma.assetssite.update(
            where={"id": site_id},
            data={
                "name": site_data.name.strip(),
                "description": site_data.description.strip() if site_data.description else None
            }
        )
        
        site = Site(
            id=updated_site.id,
            name=updated_site.name,
            description=updated_site.description,
            createdAt=updated_site.createdAt,
            updatedAt=updated_site.updatedAt
        )
        
        return SiteResponse(site=site)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating site: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update site")

@router.delete("/bulk-delete")
async def bulk_delete_sites(
    request: BulkDeleteRequest,
    auth: dict = Depends(verify_auth)
):
    """Bulk delete sites"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete sites
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete sites"
            )
        
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="Invalid request. Expected an array of site IDs.")
        
        # Check which sites have associated assets
        sites = await prisma.assetssite.find_many(
            where={"id": {"in": request.ids}}
        )
        
        sites_with_assets: List[str] = []
        sites_to_delete: List[str] = []
        
        # Check each site for associated assets
        for site in sites:
            assets_count = await prisma.assets.count(
                where={
                    "site": site.name,
                    "isDeleted": False
                },
                take=1
            )
            
            if assets_count > 0:
                sites_with_assets.append(site.name)
            else:
                sites_to_delete.append(site.id)
        
        # If any sites have associated assets, return error
        if sites_with_assets:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete site(s) with associated assets: {', '.join(sites_with_assets)}. Please reassign or delete assets first.",
            )
        
        # Delete all sites that don't have associated assets
        result = await prisma.assetssite.delete_many(
            where={"id": {"in": sites_to_delete}}
        )
        
        return {
            "success": True,
            "deletedCount": result,
            "message": f"{result} site(s) deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        if 'p1001' in error_str or 'p2024' in error_str or 'connection' in error_str:
            raise HTTPException(
                status_code=503,
                detail="Database connection limit reached. Please try again in a moment."
            )
        logger.error(f"Error bulk deleting sites: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete sites")

@router.delete("/{site_id}")
async def delete_site(
    site_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a site"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete sites
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete sites"
            )
        
        # Check if site exists
        site = await prisma.assetssite.find_unique(
            where={"id": site_id}
        )
        
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")
        
        # Check if any assets use this site
        assets_count = await prisma.assets.count(
            where={
                "site": site.name,
                "isDeleted": False
            },
            take=1
        )
        
        if assets_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete site with associated assets. Please reassign or delete assets first."
            )
        
        # Delete site using Prisma
        await prisma.assetssite.delete(
            where={"id": site_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting site: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete site")

