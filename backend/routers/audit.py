"""
Audit API router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from datetime import datetime
import logging

from models.audit import AuditCreate, AuditUpdate, AuditsListResponse, AuditDetailResponse, AuditStatsResponse
from auth import verify_auth
from database import prisma

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets", tags=["audit"])

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}")

@router.get("/{asset_id}/audit", response_model=AuditsListResponse)
async def get_asset_audits(
    asset_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get all audit records for a specific asset"""
    try:
        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"id": asset_id}
        )
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Get all audit records for this asset
        audits_data = await prisma.assetsaudithistory.find_many(
            where={"assetId": asset_id},
            order={"auditDate": "desc"}
        )
        
        # Format audits for response
        audits = []
        for audit in audits_data:
            audit_dict = {
                "id": str(audit.id),
                "assetId": str(audit.assetId),
                "auditType": audit.auditType,
                "auditDate": audit.auditDate.isoformat() if hasattr(audit.auditDate, 'isoformat') else str(audit.auditDate),
                "notes": audit.notes if audit.notes else None,
                "auditor": audit.auditor if audit.auditor else None,
                "status": audit.status if audit.status else None,
                "createdAt": audit.createdAt.isoformat() if hasattr(audit.createdAt, 'isoformat') else str(audit.createdAt),
                "updatedAt": audit.updatedAt.isoformat() if hasattr(audit.updatedAt, 'isoformat') else str(audit.updatedAt),
            }
            audits.append(audit_dict)
        
        return AuditsListResponse(audits=audits)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching audit history: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch audit history")


@router.post("/{asset_id}/audit", response_model=AuditDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_audit(
    asset_id: str,
    audit_data: AuditCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new audit record for an asset"""
    try:
        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"id": asset_id}
        )
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Parse audit date
        audit_date = parse_date(audit_data.auditDate)
        
        # Create audit record
        audit = await prisma.assetsaudithistory.create(
            data={
                "assetId": asset_id,
                "auditType": audit_data.auditType,
                "auditDate": audit_date,
                "notes": audit_data.notes,
                "auditor": audit_data.auditor,
                "status": audit_data.status or "Completed"
            }
        )
        
        # Format response
        audit_dict = {
            "id": str(audit.id),
            "assetId": str(audit.assetId),
            "auditType": audit.auditType,
            "auditDate": audit.auditDate.isoformat() if hasattr(audit.auditDate, 'isoformat') else str(audit.auditDate),
            "notes": audit.notes if audit.notes else None,
            "auditor": audit.auditor if audit.auditor else None,
            "status": audit.status if audit.status else None,
            "createdAt": audit.createdAt.isoformat() if hasattr(audit.createdAt, 'isoformat') else str(audit.createdAt),
            "updatedAt": audit.updatedAt.isoformat() if hasattr(audit.updatedAt, 'isoformat') else str(audit.updatedAt),
        }
        
        return AuditDetailResponse(audit=audit_dict)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating audit record: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create audit record")


@router.patch("/audit/{audit_id}", response_model=AuditDetailResponse)
async def update_audit(
    audit_id: str,
    audit_data: AuditUpdate,
    auth: dict = Depends(verify_auth)
):
    """Update an audit record"""
    try:
        # Check if audit exists
        existing_audit = await prisma.assetsaudithistory.find_unique(
            where={"id": audit_id}
        )
        
        if not existing_audit:
            raise HTTPException(status_code=404, detail="Audit record not found")
        
        # Build update data
        update_data: Dict[str, Any] = {}
        
        if audit_data.auditType is not None:
            update_data["auditType"] = audit_data.auditType
        
        if audit_data.auditDate is not None:
            update_data["auditDate"] = parse_date(audit_data.auditDate)
        
        if audit_data.notes is not None:
            update_data["notes"] = audit_data.notes
        
        if audit_data.auditor is not None:
            update_data["auditor"] = audit_data.auditor
        
        if audit_data.status is not None:
            update_data["status"] = audit_data.status
        
        # Update audit record
        audit = await prisma.assetsaudithistory.update(
            where={"id": audit_id},
            data=update_data
        )
        
        # Format response
        audit_dict = {
            "id": str(audit.id),
            "assetId": str(audit.assetId),
            "auditType": audit.auditType,
            "auditDate": audit.auditDate.isoformat() if hasattr(audit.auditDate, 'isoformat') else str(audit.auditDate),
            "notes": audit.notes if audit.notes else None,
            "auditor": audit.auditor if audit.auditor else None,
            "status": audit.status if audit.status else None,
            "createdAt": audit.createdAt.isoformat() if hasattr(audit.createdAt, 'isoformat') else str(audit.createdAt),
            "updatedAt": audit.updatedAt.isoformat() if hasattr(audit.updatedAt, 'isoformat') else str(audit.updatedAt),
        }
        
        return AuditDetailResponse(audit=audit_dict)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating audit record: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update audit record")


@router.delete("/audit/{audit_id}")
async def delete_audit(
    audit_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete an audit record"""
    try:
        # Check if audit exists
        audit = await prisma.assetsaudithistory.find_unique(
            where={"id": audit_id}
        )
        
        if not audit:
            raise HTTPException(status_code=404, detail="Audit record not found")
        
        # Delete audit record
        await prisma.assetsaudithistory.delete(
            where={"id": audit_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting audit record: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete audit record")


@router.get("/audit/stats", response_model=AuditStatsResponse)
async def get_audit_stats(
    auth: dict = Depends(verify_auth)
):
    """Get audit statistics (recent audits)"""
    try:
        # Get recent audit history (last 10 audits)
        recent_audits_data = await prisma.assetsaudithistory.find_many(
            take=10,
            include={"asset": True},
            order={"createdAt": "desc"}
        )
        
        # Format the response
        recent_audits = []
        for audit in recent_audits_data:
            audit_dict = {
                "id": str(audit.id),
                "assetId": str(audit.assetId),
                "auditType": audit.auditType,
                "auditDate": audit.auditDate.isoformat() if hasattr(audit.auditDate, 'isoformat') else str(audit.auditDate),
                "notes": audit.notes if audit.notes else None,
                "auditor": audit.auditor if audit.auditor else None,
                "status": audit.status if audit.status else None,
                "createdAt": audit.createdAt.isoformat() if hasattr(audit.createdAt, 'isoformat') else str(audit.createdAt),
                "updatedAt": audit.updatedAt.isoformat() if hasattr(audit.updatedAt, 'isoformat') else str(audit.updatedAt),
                "asset": {
                    "id": str(audit.asset.id),
                    "assetTagId": str(audit.asset.assetTagId),
                    "description": str(audit.asset.description)
                } if audit.asset else None
            }
            recent_audits.append(audit_dict)
        
        return AuditStatsResponse(recentAudits=recent_audits)
    
    except Exception as e:
        logger.error(f"Error fetching audit statistics: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch audit statistics")

