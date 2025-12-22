"""
Forms API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Path, Body
from typing import Optional, Union
import logging
import json
from datetime import datetime

from models.forms import (
    AccountabilityForm,
    ReturnForm,
    AccountabilityFormsResponse,
    ReturnFormsResponse,
    CreateAccountabilityFormRequest,
    CreateReturnFormRequest,
    AccountabilityFormResponse,
    ReturnFormResponse,
    FormHistoryResponse,
    DeleteFormResponse,
    PaginationInfo,
    FormHistoryCounts,
    EmployeeInfo,
)
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/forms", tags=["forms"])


def accountability_form_to_response(db_form) -> AccountabilityForm:
    """Convert database accountability form to response model"""
    employee_info = None
    if db_form.employeeUser:
        employee_info = EmployeeInfo(
            id=db_form.employeeUser.id,
            name=db_form.employeeUser.name,
            email=db_form.employeeUser.email,
            department=db_form.employeeUser.department,
        )
    
    form_data = None
    if db_form.formData:
        try:
            form_data = json.loads(db_form.formData) if isinstance(db_form.formData, str) else db_form.formData
        except:
            form_data = None
    
    return AccountabilityForm(
        id=db_form.id,
        employeeUserId=db_form.employeeUserId,
        dateIssued=db_form.dateIssued,
        department=db_form.department,
        accountabilityFormNo=db_form.accountabilityFormNo,
        formData=form_data,
        employeeUser=employee_info,
        createdAt=db_form.createdAt,
        updatedAt=db_form.updatedAt,
    )


def return_form_to_response(db_form) -> ReturnForm:
    """Convert database return form to response model"""
    employee_info = None
    if db_form.employeeUser:
        employee_info = EmployeeInfo(
            id=db_form.employeeUser.id,
            name=db_form.employeeUser.name,
            email=db_form.employeeUser.email,
            department=db_form.employeeUser.department,
        )
    
    form_data = None
    if db_form.formData:
        try:
            form_data = json.loads(db_form.formData) if isinstance(db_form.formData, str) else db_form.formData
        except:
            form_data = None
    
    return ReturnForm(
        id=db_form.id,
        employeeUserId=db_form.employeeUserId,
        dateReturned=db_form.dateReturned,
        department=db_form.department,
        ctrlNo=db_form.ctrlNo,
        returnType=db_form.returnType,
        formData=form_data,
        employeeUser=employee_info,
        createdAt=db_form.createdAt,
        updatedAt=db_form.updatedAt,
    )


@router.get("/accountability-form", response_model=AccountabilityFormsResponse)
async def get_accountability_forms(
    employeeId: Optional[str] = Query(None, description="Filter by employee ID"),
    auth: dict = Depends(verify_auth)
):
    """Get all accountability forms"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        where_clause = {}
        if employeeId:
            where_clause["employeeUserId"] = employeeId
        
        db_forms = await prisma.accountabilityform.find_many(
            where=where_clause if where_clause else None,
            include={"employeeUser": True},
            order={"dateIssued": "desc"},
        )
        
        forms = [accountability_form_to_response(f) for f in db_forms]
        
        return AccountabilityFormsResponse(accountabilityForms=forms)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching accountability forms: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch accountability forms")


@router.post("/accountability-form", response_model=AccountabilityFormResponse, status_code=201)
async def create_accountability_form(
    request: CreateAccountabilityFormRequest = Body(...),
    auth: dict = Depends(verify_auth)
):
    """Create a new accountability form"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Parse date
        date_issued = datetime.fromisoformat(request.dateIssued.replace('Z', '+00:00'))
        
        # Convert formData to JSON string
        form_data_json = json.dumps(request.formData) if request.formData else None
        
        db_form = await prisma.accountabilityform.create(
            data={
                "employeeUserId": request.employeeUserId,
                "dateIssued": date_issued,
                "department": request.department,
                "accountabilityFormNo": request.accountabilityFormNo,
                "formData": form_data_json,
            },
            include={"employeeUser": True},
        )
        
        return AccountabilityFormResponse(accountabilityForm=accountability_form_to_response(db_form))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating accountability form: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create accountability form")


@router.get("/return-form", response_model=ReturnFormsResponse)
async def get_return_forms(
    employeeId: Optional[str] = Query(None, description="Filter by employee ID"),
    auth: dict = Depends(verify_auth)
):
    """Get all return forms"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        where_clause = {}
        if employeeId:
            where_clause["employeeUserId"] = employeeId
        
        db_forms = await prisma.returnform.find_many(
            where=where_clause if where_clause else None,
            include={"employeeUser": True},
            order={"dateReturned": "desc"},
        )
        
        forms = [return_form_to_response(f) for f in db_forms]
        
        return ReturnFormsResponse(returnForms=forms)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching return forms: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch return forms")


@router.post("/return-form", response_model=ReturnFormResponse, status_code=201)
async def create_return_form(
    request: CreateReturnFormRequest = Body(...),
    auth: dict = Depends(verify_auth)
):
    """Create a new return form"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Parse date
        date_returned = datetime.fromisoformat(request.dateReturned.replace('Z', '+00:00'))
        
        # Convert formData to JSON string
        form_data_json = json.dumps(request.formData) if request.formData else None
        
        db_form = await prisma.returnform.create(
            data={
                "employeeUserId": request.employeeUserId,
                "dateReturned": date_returned,
                "department": request.department,
                "ctrlNo": request.ctrlNo,
                "returnType": request.returnType or "Return to Office",
                "formData": form_data_json,
            },
            include={"employeeUser": True},
        )
        
        return ReturnFormResponse(returnForm=return_form_to_response(db_form))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating return form: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create return form")


@router.get("/history", response_model=FormHistoryResponse)
async def get_form_history(
    formType: str = Query("accountability", description="Form type: accountability or return"),
    search: Optional[str] = Query(None, description="Search term"),
    searchType: str = Query("unified", description="Search type: unified, employee, department, formNo"),
    page: int = Query(1, ge=1, description="Page number"),
    pageSize: int = Query(100, ge=1, le=500, description="Page size"),
    auth: dict = Depends(verify_auth)
):
    """Get form history with pagination and search"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        skip = (page - 1) * pageSize
        
        # Build where clauses for both form types (for counts)
        return_where = {}
        accountability_where = {}
        
        if search:
            search_lower = search.lower()
            if searchType == "unified":
                return_where["OR"] = [
                    {"employeeUser": {"name": {"contains": search_lower, "mode": "insensitive"}}},
                    {"employeeUser": {"email": {"contains": search_lower, "mode": "insensitive"}}},
                    {"department": {"contains": search_lower, "mode": "insensitive"}},
                    {"ctrlNo": {"contains": search_lower, "mode": "insensitive"}},
                ]
                accountability_where["OR"] = [
                    {"employeeUser": {"name": {"contains": search_lower, "mode": "insensitive"}}},
                    {"employeeUser": {"email": {"contains": search_lower, "mode": "insensitive"}}},
                    {"department": {"contains": search_lower, "mode": "insensitive"}},
                    {"accountabilityFormNo": {"contains": search_lower, "mode": "insensitive"}},
                ]
            elif searchType == "employee":
                return_where["OR"] = [
                    {"employeeUser": {"name": {"contains": search_lower, "mode": "insensitive"}}},
                    {"employeeUser": {"email": {"contains": search_lower, "mode": "insensitive"}}},
                ]
                accountability_where["OR"] = [
                    {"employeeUser": {"name": {"contains": search_lower, "mode": "insensitive"}}},
                    {"employeeUser": {"email": {"contains": search_lower, "mode": "insensitive"}}},
                ]
            elif searchType == "department":
                return_where["department"] = {"contains": search_lower, "mode": "insensitive"}
                accountability_where["department"] = {"contains": search_lower, "mode": "insensitive"}
            elif searchType == "formNo":
                return_where["ctrlNo"] = {"contains": search_lower, "mode": "insensitive"}
                accountability_where["accountabilityFormNo"] = {"contains": search_lower, "mode": "insensitive"}
        
        # Fetch counts: active tab gets filtered count, inactive tab gets total count
        if formType == "return":
            # Return is active - get filtered count for return, total for accountability
            return_forms_count = await prisma.returnform.count(where=return_where if return_where else None)
            accountability_forms_count = await prisma.accountabilityform.count()  # Total count (no filter)
        else:
            # Accountability is active - get filtered count for accountability, total for return
            return_forms_count = await prisma.returnform.count()  # Total count (no filter)
            accountability_forms_count = await prisma.accountabilityform.count(where=accountability_where if accountability_where else None)
        
        if formType == "return":
            # Return Forms
            db_forms = await prisma.returnform.find_many(
                where=return_where if return_where else None,
                include={"employeeUser": True},
                order={"dateReturned": "desc"},
                skip=skip,
                take=pageSize,
            )
            
            forms = [return_form_to_response(f) for f in db_forms]
            total = return_forms_count
            total_pages = (total + pageSize - 1) // pageSize if total > 0 else 1
            
            return FormHistoryResponse(
                returnForms=forms,
                accountabilityForms=None,
                pagination=PaginationInfo(
                    page=page,
                    pageSize=pageSize,
                    total=total,
                    totalPages=total_pages,
                    hasNextPage=page < total_pages,
                    hasPreviousPage=page > 1,
                ),
                counts=FormHistoryCounts(
                    returnForms=return_forms_count,
                    accountabilityForms=accountability_forms_count,
                )
            )
        else:
            # Accountability Forms
            db_forms = await prisma.accountabilityform.find_many(
                where=accountability_where if accountability_where else None,
                include={"employeeUser": True},
                order={"dateIssued": "desc"},
                skip=skip,
                take=pageSize,
            )
            
            forms = [accountability_form_to_response(f) for f in db_forms]
            total = accountability_forms_count
            total_pages = (total + pageSize - 1) // pageSize if total > 0 else 1
            
            return FormHistoryResponse(
                returnForms=None,
                accountabilityForms=forms,
                pagination=PaginationInfo(
                    page=page,
                    pageSize=pageSize,
                    total=total,
                    totalPages=total_pages,
                    hasNextPage=page < total_pages,
                    hasPreviousPage=page > 1,
                ),
                counts=FormHistoryCounts(
                    returnForms=return_forms_count,
                    accountabilityForms=accountability_forms_count,
                )
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching form history: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch form history")


@router.get("/history/{form_id}", response_model=Union[AccountabilityFormResponse, ReturnFormResponse])
async def get_form_by_id(
    form_id: str = Path(..., description="Form ID"),
    formType: str = Query("accountability", description="Form type: accountability or return"),
    auth: dict = Depends(verify_auth)
):
    """Get a single form by ID"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if formType == "return":
            db_form = await prisma.returnform.find_unique(
                where={"id": form_id},
                include={"employeeUser": True},
            )
            
            if not db_form:
                raise HTTPException(status_code=404, detail="Return form not found")
            
            form = return_form_to_response(db_form)
            
            # Fetch asset details if formData has selectedAssets
            if form.formData and isinstance(form.formData, dict) and "selectedAssets" in form.formData:
                selected_assets = form.formData.get("selectedAssets", [])
                if isinstance(selected_assets, list) and len(selected_assets) > 0:
                    asset_ids = [asset.get("id") for asset in selected_assets if asset.get("id")]
                    if asset_ids:
                        assets = await prisma.assets.find_many(
                            where={"id": {"in": asset_ids}, "isDeleted": False},
                            include={
                                "category": {"select": {"id": True, "name": True}},
                                "subCategory": {"select": {"id": True, "name": True}},
                            }
                        )
                        
                        # Merge asset details with form data
                        asset_map = {asset.id: asset for asset in assets}
                        for asset in selected_assets:
                            asset_id = asset.get("id")
                            if asset_id and asset_id in asset_map:
                                asset_detail = asset_map[asset_id]
                                asset["category"] = {"id": asset_detail.category.id, "name": asset_detail.category.name} if asset_detail.category else None
                                asset["subCategory"] = {"id": asset_detail.subCategory.id, "name": asset_detail.subCategory.name} if asset_detail.subCategory else None
            
            return ReturnFormResponse(returnForm=form)
        else:
            db_form = await prisma.accountabilityform.find_unique(
                where={"id": form_id},
                include={"employeeUser": True},
            )
            
            if not db_form:
                raise HTTPException(status_code=404, detail="Accountability form not found")
            
            form = accountability_form_to_response(db_form)
            
            # Fetch asset details if formData has selectedAssets
            if form.formData and isinstance(form.formData, dict) and "selectedAssets" in form.formData:
                selected_assets = form.formData.get("selectedAssets", [])
                if isinstance(selected_assets, list) and len(selected_assets) > 0:
                    asset_ids = [asset.get("id") for asset in selected_assets if asset.get("id")]
                    if asset_ids:
                        assets = await prisma.assets.find_many(
                            where={"id": {"in": asset_ids}, "isDeleted": False},
                            include={
                                "category": {"select": {"id": True, "name": True}},
                                "subCategory": {"select": {"id": True, "name": True}},
                            }
                        )
                        
                        # Merge asset details with form data
                        asset_map = {asset.id: asset for asset in assets}
                        for asset in selected_assets:
                            asset_id = asset.get("id")
                            if asset_id and asset_id in asset_map:
                                asset_detail = asset_map[asset_id]
                                asset["category"] = {"id": asset_detail.category.id, "name": asset_detail.category.name} if asset_detail.category else None
                                asset["subCategory"] = {"id": asset_detail.subCategory.id, "name": asset_detail.subCategory.name} if asset_detail.subCategory else None
            
            return AccountabilityFormResponse(accountabilityForm=form)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching form: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch form")


@router.delete("/history/{form_id}", response_model=DeleteFormResponse)
async def delete_form(
    form_id: str = Path(..., description="Form ID"),
    formType: str = Query("accountability", description="Form type: accountability or return"),
    auth: dict = Depends(verify_auth)
):
    """Delete a form"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if formType == "return":
            # Check if form exists
            form = await prisma.returnform.find_unique(where={"id": form_id})
            if not form:
                raise HTTPException(status_code=404, detail="Return form not found")
            
            # Delete the form
            await prisma.returnform.delete(where={"id": form_id})
            
            return DeleteFormResponse(message="Return form deleted successfully")
        else:
            # Check if form exists
            form = await prisma.accountabilityform.find_unique(where={"id": form_id})
            if not form:
                raise HTTPException(status_code=404, detail="Accountability form not found")
            
            # Delete the form
            await prisma.accountabilityform.delete(where={"id": form_id})
            
            return DeleteFormResponse(message="Accountability form deleted successfully")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting form: {type(e).__name__}: {str(e)}", exc_info=True)
        if "p2025" in str(e).lower():
            raise HTTPException(status_code=404, detail="Form not found")
        raise HTTPException(status_code=500, detail="Failed to delete form")

