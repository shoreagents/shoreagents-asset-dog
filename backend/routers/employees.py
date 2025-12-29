"""
Employees API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from datetime import date as date_type
import logging
from models.employees import (
    Employee,
    EmployeeCreate,
    EmployeeUpdate,
    EmployeesResponse,
    EmployeeResponse,
    PaginationInfo,
    CheckoutForEmployee,
    AssetInfoForCheckout
)
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/employees", tags=["employees"])

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

@router.get("", response_model=EmployeesResponse)
async def get_employees(
    search: Optional[str] = Query(None),
    searchType: Optional[str] = Query("unified", description="Search type: unified, name, email, department"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=1000),
    auth: dict = Depends(verify_auth)
):
    """Get all employees with optional search filter and pagination"""
    try:
        skip = (page - 1) * pageSize
        
        # Build where clause based on search
        where_clause = {}
        if search:
            search_lower = search.lower()
            if searchType == "name":
                where_clause = {
                    "name": {
                        "contains": search,
                        "mode": "insensitive"
                    }
                }
            elif searchType == "email":
                where_clause = {
                    "email": {
                        "contains": search,
                        "mode": "insensitive"
                    }
                }
            elif searchType == "department":
                where_clause = {
                    "department": {
                        "contains": search,
                        "mode": "insensitive"
                    }
                }
            else:  # unified
                where_clause = {
                    "OR": [
                        {"name": {"contains": search, "mode": "insensitive"}},
                        {"email": {"contains": search, "mode": "insensitive"}},
                        {"department": {"contains": search, "mode": "insensitive"}},
                    ]
                }
        
        # Get total count for pagination
        total_count = await prisma.employeeuser.count(where=where_clause)
        
        # Get employees with checkouts
        employees_data = await prisma.employeeuser.find_many(
            where=where_clause,
            include={
                "checkouts": {
                    "include": {
                        "asset": {
                            "include": {
                                "category": True,
                                "subCategory": True
                            }
                        },
                        "checkins": True
                    }
                }
            },
            order={"name": "asc"},
            skip=skip,
            take=pageSize
        )
        
        employees = []
        for emp in employees_data:
            try:
                # Filter checkouts to only include active ones (those without checkins)
                # Also filter by asset status "Checked out"
                active_checkouts = []
                if emp.checkouts:
                    for checkout in emp.checkouts:
                        # Only include checkouts where asset status is "Checked out" and there are no checkins
                        if (checkout.asset and 
                            checkout.asset.status == "Checked out" and 
                            (not checkout.checkins or len(checkout.checkins) == 0)):
                            
                            asset_info = AssetInfoForCheckout(
                                id=str(checkout.asset.id),
                                assetTagId=str(checkout.asset.assetTagId),
                                description=str(checkout.asset.description),
                                status=checkout.asset.status if checkout.asset.status else None,
                                category={"name": str(checkout.asset.category.name)} if checkout.asset.category else None,
                                subCategory={"name": str(checkout.asset.subCategory.name)} if checkout.asset.subCategory else None,
                                location=checkout.asset.location if checkout.asset.location else None,
                                brand=checkout.asset.brand if checkout.asset.brand else None,
                                model=checkout.asset.model if checkout.asset.model else None
                            )
                            
                            # Convert datetime to date for checkoutDate and expectedReturnDate
                            checkout_date = checkout.checkoutDate.date() if hasattr(checkout.checkoutDate, 'date') else checkout.checkoutDate
                            expected_return_date = None
                            if checkout.expectedReturnDate:
                                expected_return_date = checkout.expectedReturnDate.date() if hasattr(checkout.expectedReturnDate, 'date') else checkout.expectedReturnDate
                            
                            checkout_info = CheckoutForEmployee(
                                id=str(checkout.id),
                                checkoutDate=checkout_date,
                                expectedReturnDate=expected_return_date,
                                asset=asset_info,
                                checkins=[{"id": str(c.id)} for c in checkout.checkins] if checkout.checkins else []
                            )
                            active_checkouts.append(checkout_info)
                
                # Sort checkouts by checkoutDate descending
                active_checkouts.sort(key=lambda x: x.checkoutDate, reverse=True)
                
                employee = Employee(
                    id=str(emp.id),
                    name=str(emp.name),
                    email=str(emp.email),
                    department=emp.department if emp.department else None,
                    createdAt=emp.createdAt,
                    updatedAt=emp.updatedAt,
                    checkouts=active_checkouts
                )
                employees.append(employee)
            except Exception as e:
                logger.error(f"Error creating Employee model: {type(e).__name__}: {str(e)}", exc_info=True)
                continue
        
        total_pages = (total_count + pageSize - 1) // pageSize if total_count > 0 else 0
        
        pagination = PaginationInfo(
            page=page,
            pageSize=pageSize,
            total=total_count,
            totalPages=total_pages,
            hasNextPage=page < total_pages,
            hasPreviousPage=page > 1
        )
        
        return EmployeesResponse(employees=employees, pagination=pagination)
    
    except Exception as e:
        logger.error(f"Error fetching employees: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch employees")

@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get a single employee by ID with their active checkouts"""
    try:
        employee_data = await prisma.employeeuser.find_unique(
            where={"id": employee_id},
            include={
                "checkouts": {
                    "include": {
                        "asset": {
                            "include": {
                                "category": True,
                                "subCategory": True
                            }
                        },
                        "checkins": True
                    }
                }
            }
        )
        
        if not employee_data:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Filter checkouts to only include active ones (those without checkins)
        # Also filter by asset status "Checked out"
        active_checkouts = []
        if employee_data.checkouts:
            for checkout in employee_data.checkouts:
                # Only include checkouts where asset status is "Checked out" and there are no checkins
                if (checkout.asset and 
                    checkout.asset.status == "Checked out" and 
                    (not checkout.checkins or len(checkout.checkins) == 0)):
                    
                    asset_info = AssetInfoForCheckout(
                        id=str(checkout.asset.id),
                        assetTagId=str(checkout.asset.assetTagId),
                        description=str(checkout.asset.description),
                        status=checkout.asset.status if checkout.asset.status else None,
                        category={"name": str(checkout.asset.category.name)} if checkout.asset.category else None,
                        subCategory={"name": str(checkout.asset.subCategory.name)} if checkout.asset.subCategory else None,
                        location=checkout.asset.location if checkout.asset.location else None,
                        brand=checkout.asset.brand if checkout.asset.brand else None,
                        model=checkout.asset.model if checkout.asset.model else None
                    )
                    
                    # Convert datetime to date for checkoutDate and expectedReturnDate
                    checkout_date = checkout.checkoutDate.date() if hasattr(checkout.checkoutDate, 'date') else checkout.checkoutDate
                    expected_return_date = None
                    if checkout.expectedReturnDate:
                        expected_return_date = checkout.expectedReturnDate.date() if hasattr(checkout.expectedReturnDate, 'date') else checkout.expectedReturnDate
                    
                    checkout_info = CheckoutForEmployee(
                        id=str(checkout.id),
                        checkoutDate=checkout_date,
                        expectedReturnDate=expected_return_date,
                        asset=asset_info,
                        checkins=[{"id": str(c.id)} for c in checkout.checkins] if checkout.checkins else []
                    )
                    active_checkouts.append(checkout_info)
        
        # Sort checkouts by checkoutDate descending
        active_checkouts.sort(key=lambda x: x.checkoutDate, reverse=True)
        
        employee = Employee(
            id=str(employee_data.id),
            name=str(employee_data.name),
            email=str(employee_data.email),
            department=employee_data.department if employee_data.department else None,
            createdAt=employee_data.createdAt,
            updatedAt=employee_data.updatedAt,
            checkouts=active_checkouts
        )
        
        return EmployeeResponse(employee=employee)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch employee")

@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    employee_data: EmployeeCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new employee"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageEmployees to create employees
        has_permission = await check_permission(user_id, "canManageEmployees")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create employees"
            )
        # Check if employee with same email exists
        existing = await prisma.employeeuser.find_first(
            where={
                "email": {
                    "equals": employee_data.email.lower().strip(),
                    "mode": "insensitive"
                }
            }
        )
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="An employee with this email already exists"
            )
        
        # Create new employee using Prisma
        new_employee = await prisma.employeeuser.create(
            data={
                "name": employee_data.name.strip(),
                "email": employee_data.email.lower().strip(),
                "department": employee_data.department.strip() if employee_data.department else None
            }
        )
        
        employee = Employee(
            id=str(new_employee.id),
            name=str(new_employee.name),
            email=str(new_employee.email),
            department=new_employee.department if new_employee.department else None,
            createdAt=new_employee.createdAt,
            updatedAt=new_employee.updatedAt
        )
        
        return EmployeeResponse(employee=employee)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating employee: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create employee")

@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    employee_data: EmployeeUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an existing employee"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageEmployees to update employees
        has_permission = await check_permission(user_id, "canManageEmployees")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update employees"
            )
        # Check if employee exists
        existing = await prisma.employeeuser.find_unique(
            where={"id": employee_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check if another employee with same email exists
        duplicate = await prisma.employeeuser.find_first(
            where={
                "email": {
                    "equals": employee_data.email.lower().strip(),
                    "mode": "insensitive"
                },
                "id": {
                    "not": employee_id
                }
            }
        )
        
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="An employee with this email already exists"
            )
        
        # Update employee using Prisma
        updated_employee = await prisma.employeeuser.update(
            where={"id": employee_id},
            data={
                "name": employee_data.name.strip(),
                "email": employee_data.email.lower().strip(),
                "department": employee_data.department.strip() if employee_data.department else None
            }
        )
        
        employee = Employee(
            id=str(updated_employee.id),
            name=str(updated_employee.name),
            email=str(updated_employee.email),
            department=updated_employee.department if updated_employee.department else None,
            createdAt=updated_employee.createdAt,
            updatedAt=updated_employee.updatedAt
        )
        
        return EmployeeResponse(employee=employee)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating employee: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update employee")

@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete an employee"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageEmployees to delete employees
        has_permission = await check_permission(user_id, "canManageEmployees")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete employees"
            )
        # Check if employee exists
        employee = await prisma.employeeuser.find_unique(
            where={"id": employee_id}
        )
        
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check if employee has any active checkouts (checkouts without checkins)
        active_checkouts = await prisma.assetscheckout.find_first(
            where={
                "employeeUserId": employee_id,
                "checkins": {
                    "none": {}
                }
            }
        )
        
        if active_checkouts:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete employee with active asset checkouts"
            )
        
        # Delete employee using Prisma
        await prisma.employeeuser.delete(
            where={"id": employee_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting employee: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete employee")

