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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/locations", tags=["locations"])

@router.get("", response_model=LocationsResponse)
async def get_locations(
    search: Optional[str] = Query(None),
    auth: dict = Depends(verify_auth)
):
    """Get all locations with optional search filter"""
    try:
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

@router.delete("/{location_id}")
async def delete_location(
    location_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a location"""
    try:
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

