"""
Locations API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
import logging
from models.locations import (
    Location,
    LocationCreate,
    LocationUpdate,
    LocationsResponse,
    LocationResponse
)
from auth import verify_auth
from database import prisma
from typing import List
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/locations", tags=["locations"])

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

@router.get("", response_model=LocationsResponse)
async def get_locations(
    search: Optional[str] = Query(None),
    auth: dict = Depends(verify_auth)
):
    """Get all locations with optional search filter"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # GET endpoint is open - all authenticated users can view locations (needed for dropdowns)
        
        if search:
            locations_data = await prisma.assetslocation.find_many(
                where={
                    "name": {
                        "contains": search,
                        "mode": "insensitive"
                    }
                },
                order={"name": "asc"}
            )
        else:
            locations_data = await prisma.assetslocation.find_many(
                order={"name": "asc"}
            )
        
        locations = []
        for loc in locations_data:
            try:
                location = Location(
                    id=str(loc.id),
                    name=str(loc.name),
                    description=loc.description if loc.description else None,
                    createdAt=loc.createdAt,
                    updatedAt=loc.updatedAt
                )
                locations.append(location)
            except Exception as e:
                logger.error(f"Error creating Location model: {type(e).__name__}: {str(e)}", exc_info=True)
                continue
        
        return LocationsResponse(locations=locations)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching locations: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch locations")

@router.post("", response_model=LocationResponse, status_code=201)
async def create_location(
    location_data: LocationCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new location"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to create locations
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create locations"
            )
        
        # Check if location with same name exists
        existing = await prisma.assetslocation.find_first(
            where={
                "name": {
                    "equals": location_data.name.strip(),
                    "mode": "insensitive"
                }
            }
        )
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A location with this name already exists"
            )
        
        # Create new location using Prisma
        new_location = await prisma.assetslocation.create(
            data={
                "name": location_data.name.strip(),
                "description": location_data.description.strip() if location_data.description else None
            }
        )
        
        location = Location(
            id=new_location.id,
            name=new_location.name,
            description=new_location.description,
            createdAt=new_location.createdAt,
            updatedAt=new_location.updatedAt
        )
        
        return LocationResponse(location=location)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating location: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create location")

@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: str,
    location_data: LocationUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an existing location"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to update locations
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update locations"
            )
        
        # Check if location exists
        existing = await prisma.assetslocation.find_unique(
            where={"id": location_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Location not found")
        
        # Check if another location with same name exists
        duplicate = await prisma.assetslocation.find_first(
            where={
                "name": {
                    "equals": location_data.name.strip(),
                    "mode": "insensitive"
                },
                "id": {
                    "not": location_id
                }
            }
        )
        
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="A location with this name already exists"
            )
        
        # Update location using Prisma
        updated_location = await prisma.assetslocation.update(
            where={"id": location_id},
            data={
                "name": location_data.name.strip(),
                "description": location_data.description.strip() if location_data.description else None
            }
        )
        
        location = Location(
            id=updated_location.id,
            name=updated_location.name,
            description=updated_location.description,
            createdAt=updated_location.createdAt,
            updatedAt=updated_location.updatedAt
        )
        
        return LocationResponse(location=location)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating location: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update location")

@router.delete("/bulk-delete")
async def bulk_delete_locations(
    request: BulkDeleteRequest,
    auth: dict = Depends(verify_auth)
):
    """Bulk delete locations"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete locations
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete locations"
            )
        
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="Invalid request. Expected an array of location IDs.")
        
        # Check which locations have associated assets
        locations = await prisma.assetslocation.find_many(
            where={"id": {"in": request.ids}}
        )
        
        locations_with_assets: List[str] = []
        locations_to_delete: List[str] = []
        
        # Check each location for associated assets
        for location in locations:
            assets_count = await prisma.assets.count(
                where={
                    "location": location.name,
                    "isDeleted": False
                },
                take=1
            )
            
            if assets_count > 0:
                locations_with_assets.append(location.name)
            else:
                locations_to_delete.append(location.id)
        
        # If any locations have associated assets, return error
        if locations_with_assets:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete location(s) with associated assets: {', '.join(locations_with_assets)}. Please reassign or delete assets first.",
            )
        
        # Delete all locations that don't have associated assets
        result = await prisma.assetslocation.delete_many(
            where={"id": {"in": locations_to_delete}}
        )
        
        return {
            "success": True,
            "deletedCount": result,
            "message": f"{result} location(s) deleted successfully"
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
        logger.error(f"Error bulk deleting locations: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete locations")

@router.delete("/{location_id}")
async def delete_location(
    location_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a location"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete locations
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete locations"
            )
        
        # Check if location exists
        location = await prisma.assetslocation.find_unique(
            where={"id": location_id}
        )
        
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")
        
        # Check if any assets use this location
        assets_count = await prisma.assets.count(
            where={
                "location": location.name,
                "isDeleted": False
            },
            take=1
        )
        
        if assets_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete location with associated assets. Please reassign or delete assets first."
            )
        
        # Delete location using Prisma
        await prisma.assetslocation.delete(
            where={"id": location_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting location: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete location")

