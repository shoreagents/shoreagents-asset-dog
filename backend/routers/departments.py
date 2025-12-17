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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/departments", tags=["departments"])

@router.get("", response_model=DepartmentsResponse)
async def get_departments(
    search: Optional[str] = Query(None),
    auth: dict = Depends(verify_auth)
):
    """Get all departments with optional search filter"""
    try:
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

@router.delete("/{department_id}")
async def delete_department(
    department_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a department"""
    try:
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

