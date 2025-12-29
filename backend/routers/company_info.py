"""
Company Info API router
Singleton resource - only one company info record exists
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from typing import Optional
import logging
import os
from datetime import datetime
from supabase import create_client, Client
from models.company_info import (
    CompanyInfo,
    CompanyInfoCreate,
    CompanyInfoUpdate,
    CompanyInfoResponse
)
from auth import verify_auth, SUPABASE_URL
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/company-info", tags=["company-info"])

def get_supabase_admin_client() -> Client:
    """Get Supabase admin client for storage operations"""
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_service_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase service role key not configured"
        )
    return create_client(SUPABASE_URL, supabase_service_key)

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

@router.get("", response_model=CompanyInfoResponse)
async def get_company_info(
    auth: dict = Depends(verify_auth)
):
    """Get company information (singleton - only one record)"""
    try:
        # Get the most recent company info record (there should only be one)
        company_info_data = await prisma.companyinfo.find_first(
            order={"createdAt": "desc"}
        )
        
        if not company_info_data:
            return CompanyInfoResponse(companyInfo=None)
        
        company_info = CompanyInfo(
            id=str(company_info_data.id),
            companyName=str(company_info_data.companyName),
            contactEmail=company_info_data.contactEmail if company_info_data.contactEmail else None,
            contactPhone=company_info_data.contactPhone if company_info_data.contactPhone else None,
            address=company_info_data.address if company_info_data.address else None,
            zipCode=company_info_data.zipCode if company_info_data.zipCode else None,
            country=company_info_data.country if company_info_data.country else None,
            website=company_info_data.website if company_info_data.website else None,
            primaryLogoUrl=company_info_data.primaryLogoUrl if company_info_data.primaryLogoUrl else None,
            secondaryLogoUrl=company_info_data.secondaryLogoUrl if company_info_data.secondaryLogoUrl else None,
            createdAt=company_info_data.createdAt,
            updatedAt=company_info_data.updatedAt
        )
        
        return CompanyInfoResponse(companyInfo=company_info)
    
    except Exception as e:
        logger.error(f"Error fetching company info: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch company info")

@router.post("", response_model=CompanyInfoResponse)
async def create_or_update_company_info(
    company_info_data: CompanyInfoCreate,
    auth: dict = Depends(verify_auth)
):
    """Create or update company information (upsert - singleton behavior)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to create/update company info
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to manage company info"
            )
        
        if not company_info_data.companyName or not company_info_data.companyName.strip():
            raise HTTPException(
                status_code=400,
                detail="Company name is required"
            )
        
        # Check if company info already exists
        existing = await prisma.companyinfo.find_first()
        
        if existing:
            # Update existing record
            updated_company_info = await prisma.companyinfo.update(
                where={"id": existing.id},
                data={
                    "companyName": company_info_data.companyName.strip(),
                    "contactEmail": company_info_data.contactEmail.strip() if company_info_data.contactEmail else None,
                    "contactPhone": company_info_data.contactPhone.strip() if company_info_data.contactPhone else None,
                    "address": company_info_data.address.strip() if company_info_data.address else None,
                    "zipCode": company_info_data.zipCode.strip() if company_info_data.zipCode else None,
                    "country": company_info_data.country.strip() if company_info_data.country else None,
                    "website": company_info_data.website.strip() if company_info_data.website else None,
                    "primaryLogoUrl": company_info_data.primaryLogoUrl.strip() if company_info_data.primaryLogoUrl else None,
                    "secondaryLogoUrl": company_info_data.secondaryLogoUrl.strip() if company_info_data.secondaryLogoUrl else None,
                }
            )
            
            company_info = CompanyInfo(
                id=str(updated_company_info.id),
                companyName=str(updated_company_info.companyName),
                contactEmail=updated_company_info.contactEmail if updated_company_info.contactEmail else None,
                contactPhone=updated_company_info.contactPhone if updated_company_info.contactPhone else None,
                address=updated_company_info.address if updated_company_info.address else None,
                zipCode=updated_company_info.zipCode if updated_company_info.zipCode else None,
                country=updated_company_info.country if updated_company_info.country else None,
                website=updated_company_info.website if updated_company_info.website else None,
                primaryLogoUrl=updated_company_info.primaryLogoUrl if updated_company_info.primaryLogoUrl else None,
                secondaryLogoUrl=updated_company_info.secondaryLogoUrl if updated_company_info.secondaryLogoUrl else None,
                createdAt=updated_company_info.createdAt,
                updatedAt=updated_company_info.updatedAt
            )
            
            return CompanyInfoResponse(companyInfo=company_info)
        else:
            # Create new record
            new_company_info = await prisma.companyinfo.create(
                data={
                    "companyName": company_info_data.companyName.strip(),
                    "contactEmail": company_info_data.contactEmail.strip() if company_info_data.contactEmail else None,
                    "contactPhone": company_info_data.contactPhone.strip() if company_info_data.contactPhone else None,
                    "address": company_info_data.address.strip() if company_info_data.address else None,
                    "zipCode": company_info_data.zipCode.strip() if company_info_data.zipCode else None,
                    "country": company_info_data.country.strip() if company_info_data.country else None,
                    "website": company_info_data.website.strip() if company_info_data.website else None,
                    "primaryLogoUrl": company_info_data.primaryLogoUrl.strip() if company_info_data.primaryLogoUrl else None,
                    "secondaryLogoUrl": company_info_data.secondaryLogoUrl.strip() if company_info_data.secondaryLogoUrl else None,
                }
            )
            
            company_info = CompanyInfo(
                id=str(new_company_info.id),
                companyName=str(new_company_info.companyName),
                contactEmail=new_company_info.contactEmail if new_company_info.contactEmail else None,
                contactPhone=new_company_info.contactPhone if new_company_info.contactPhone else None,
                address=new_company_info.address if new_company_info.address else None,
                zipCode=new_company_info.zipCode if new_company_info.zipCode else None,
                country=new_company_info.country if new_company_info.country else None,
                website=new_company_info.website if new_company_info.website else None,
                primaryLogoUrl=new_company_info.primaryLogoUrl if new_company_info.primaryLogoUrl else None,
                secondaryLogoUrl=new_company_info.secondaryLogoUrl if new_company_info.secondaryLogoUrl else None,
                createdAt=new_company_info.createdAt,
                updatedAt=new_company_info.updatedAt
            )
            
            return CompanyInfoResponse(companyInfo=company_info)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving company info: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save company info")

@router.put("", response_model=CompanyInfoResponse)
async def update_company_info(
    company_info_data: CompanyInfoUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update company information (same as POST - upsert behavior)"""
    # PUT is same as POST - upsert behavior
    return await create_or_update_company_info(company_info_data, auth)

@router.post("/upload-logo")
async def upload_logo(
    file: UploadFile = File(...),
    logoType: str = Form(...),
    auth: dict = Depends(verify_auth)
):
    """Upload a company logo (primary or secondary)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to upload logos
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to upload company logos"
            )
        
        if not logoType or logoType not in ['primary', 'secondary']:
            raise HTTPException(
                status_code=400,
                detail="Logo type must be 'primary' or 'secondary'"
            )
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed."
            )
        
        # Validate file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )
        
        # Create Supabase admin client
        supabase_admin = get_supabase_admin_client()
        
        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'png'
        sanitized_extension = file_extension.lower()
        file_name = f"company-logo-{logoType}-{timestamp}.{sanitized_extension}"
        file_path = f"company-info/{file_name}"
        
        # Upload to Supabase storage bucket 'assets' (or 'file-history' if assets bucket doesn't exist)
        public_url = None
        final_file_path = file_path
        
        try:
            # Try assets bucket first
            response = supabase_admin.storage.from_('assets').upload(
                file_path,
                file_content,
                file_options={"content-type": file.content_type or "image/png"}
            )
            
            if response:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data.get('publicUrl', '') if isinstance(url_data, dict) else str(url_data)
        except Exception as upload_error:
            # If assets bucket doesn't exist, try file-history bucket
            error_msg = str(upload_error).lower()
            if 'bucket not found' in error_msg or 'not found' in error_msg:
                try:
                    response = supabase_admin.storage.from_('file-history').upload(
                        file_path,
                        file_content,
                        file_options={"content-type": file.content_type or "image/png"}
                    )
                    if response:
                        url_data = supabase_admin.storage.from_('file-history').get_public_url(file_path)
                        public_url = url_data.get('publicUrl', '') if isinstance(url_data, dict) else str(url_data)
                except Exception as fallback_error:
                    logger.error(f"Storage upload error: {fallback_error}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload logo to storage: {fallback_error}"
                    )
            else:
                logger.error(f"Storage upload error: {upload_error}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload logo to storage: {upload_error}"
                )
        
        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded logo"
            )
        
        # Update company info with logo URL
        existing = await prisma.companyinfo.find_first()
        
        if existing:
            await prisma.companyinfo.update(
                where={"id": existing.id},
                data={
                    "primaryLogoUrl" if logoType == 'primary' else "secondaryLogoUrl": public_url,
                }
            )
        else:
            # Create company info record if it doesn't exist
            await prisma.companyinfo.create(
                data={
                    "companyName": "Company Name",  # Default, will be updated later
                    "primaryLogoUrl" if logoType == 'primary' else "secondaryLogoUrl": public_url,
                }
            )
        
        return {
            "success": True,
            "logoUrl": public_url,
            "logoType": logoType,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading logo: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload logo")

@router.delete("/delete-logo")
async def delete_logo(
    logoUrl: str = Query(..., description="Logo URL to delete"),
    auth: dict = Depends(verify_auth)
):
    """Delete a company logo from storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission - user must have canManageSetup to delete logos
        has_permission = await check_permission(user_id, "canManageSetup")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete company logos"
            )
        
        if not logoUrl:
            raise HTTPException(status_code=400, detail="Logo URL is required")
        
        # Delete file from Supabase storage
        try:
            supabase_admin = get_supabase_admin_client()
            
            # Extract bucket and path from URL
            # URLs are like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
            import re
            url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', logoUrl)
            
            if url_match:
                bucket = url_match.group(1)
                path = url_match.group(2)
                
                # Delete from storage
                try:
                    supabase_admin.storage.from_(bucket).remove([path])
                except Exception as delete_error:
                    logger.warning(f"Failed to delete logo from storage: {delete_error}")
                    # Continue even if storage deletion fails (file might not exist)
            else:
                logger.warning(f"Could not extract bucket and path from logo URL: {logoUrl}")
        except Exception as storage_error:
            logger.warning(f"Storage deletion error: {storage_error}")
            # Continue even if storage deletion fails
        
        return {
            "success": True,
            "message": "Logo deleted from storage successfully",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting logo: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete logo")

