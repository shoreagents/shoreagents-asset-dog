"""
Company Info API router
Singleton resource - only one company info record exists
"""
from fastapi import APIRouter, HTTPException, Depends
import logging
from models.company_info import (
    CompanyInfo,
    CompanyInfoCreate,
    CompanyInfoUpdate,
    CompanyInfoResponse
)
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/company-info", tags=["company-info"])

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

