"""
Departments API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
import logging
from models.departments import (
    Department,
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentsResponse,
    DepartmentResponse
)
from auth import verify_auth
from database import prisma
from typing import List
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/departments", tags=["departments"])

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

@router.get("", response_model=DepartmentsResponse)
async def get_departments(
    search: Optional[str] = Query(None),
    auth: dict = Depends(verify_auth)
):
    """Get all departments with optional search filter"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # GET endpoint is open - all authenticated users can view departments (needed for dropdowns)
        
        if search:
            departments_data = await prisma.assetsdepartment.find_many(
                where={
                    "name": {
                        "contains": search,
                        "mode": "insensitive"
                    }
                },
                order={"name": "asc"}
            )
        else:
            departments_data = await prisma.assetsdepartment.find_many(
                order={"name": "asc"}
            )
        
        departments = []
        for dept in departments_data:
            try:
                department = Department(
                    id=str(dept.id),
                    name=str(dept.name),
                    description=dept.description if dept.description else None,
                    createdAt=dept.createdAt,
                    updatedAt=dept.updatedAt
                )
                departments.append(department)
            except Exception as e:
                logger.error(f"Error creating Department model: {type(e).__name__}: {str(e)}", exc_info=True)
                continue
        
        return DepartmentsResponse(departments=departments)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching departments: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch departments")

@router.post("", response_model=DepartmentResponse, status_code=201)
async def create_department(
    department_data: DepartmentCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new department"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to create departments
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create departments"
            )
        
        # Check if department with same name exists
        existing = await prisma.assetsdepartment.find_first(
            where={
                "name": {
                    "equals": department_data.name.strip(),
                    "mode": "insensitive"
                }
            }
        )
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A department with this name already exists"
            )
        
        # Create new department using Prisma
        new_department = await prisma.assetsdepartment.create(
            data={
                "name": department_data.name.strip(),
                "description": department_data.description.strip() if department_data.description else None
            }
        )
        
        department = Department(
            id=str(new_department.id),
            name=str(new_department.name),
            description=new_department.description if new_department.description else None,
            createdAt=new_department.createdAt,
            updatedAt=new_department.updatedAt
        )
        
        return DepartmentResponse(department=department)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating department: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create department")

@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: str,
    department_data: DepartmentUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an existing department"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to update departments
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update departments"
            )
        
        # Check if department exists
        existing = await prisma.assetsdepartment.find_unique(
            where={"id": department_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Department not found")
        
        # Check if another department with same name exists
        duplicate = await prisma.assetsdepartment.find_first(
            where={
                "name": {
                    "equals": department_data.name.strip(),
                    "mode": "insensitive"
                },
                "id": {
                    "not": department_id
                }
            }
        )
        
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="A department with this name already exists"
            )
        
        # Update department using Prisma
        updated_department = await prisma.assetsdepartment.update(
            where={"id": department_id},
            data={
                "name": department_data.name.strip(),
                "description": department_data.description.strip() if department_data.description else None
            }
        )
        
        department = Department(
            id=str(updated_department.id),
            name=str(updated_department.name),
            description=updated_department.description if updated_department.description else None,
            createdAt=updated_department.createdAt,
            updatedAt=updated_department.updatedAt
        )
        
        return DepartmentResponse(department=department)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating department: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update department")

@router.delete("/bulk-delete")
async def bulk_delete_departments(
    request: BulkDeleteRequest,
    auth: dict = Depends(verify_auth)
):
    """Bulk delete departments"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete departments
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete departments"
            )
        
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="Invalid request. Expected an array of department IDs.")
        
        # Check which departments have associated assets
        departments = await prisma.assetsdepartment.find_many(
            where={"id": {"in": request.ids}}
        )
        
        departments_with_assets: List[str] = []
        departments_to_delete: List[str] = []
        
        # Check each department for associated assets
        for department in departments:
            assets_count = await prisma.assets.count(
                where={
                    "department": department.name,
                    "isDeleted": False
                },
                take=1
            )
            
            if assets_count > 0:
                departments_with_assets.append(department.name)
            else:
                departments_to_delete.append(department.id)
        
        # If any departments have associated assets, return error
        if departments_with_assets:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete department(s) with associated assets: {', '.join(departments_with_assets)}. Please reassign or delete assets first.",
            )
        
        # Delete all departments that don't have associated assets
        result = await prisma.assetsdepartment.delete_many(
            where={"id": {"in": departments_to_delete}}
        )
        
        return {
            "success": True,
            "deletedCount": result,
            "message": f"{result} department(s) deleted successfully"
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
        logger.error(f"Error bulk deleting departments: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete departments")

@router.delete("/{department_id}")
async def delete_department(
    department_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a department"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete departments
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete departments"
            )
        
        # Check if department exists
        department = await prisma.assetsdepartment.find_unique(
            where={"id": department_id}
        )
        
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        
        # Check if any assets use this department
        assets_count = await prisma.assets.count(
            where={
                "department": department.name,
                "isDeleted": False
            },
            take=1
        )
        
        if assets_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete department with associated assets. Please reassign or delete assets first."
            )
        
        # Delete department using Prisma
        await prisma.assetsdepartment.delete(
            where={"id": department_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting department: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete department")

