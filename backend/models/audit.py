"""
Pydantic models for Audit API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, date

class AuditCreate(BaseModel):
    auditType: str
    auditDate: str
    notes: Optional[str] = None
    auditor: Optional[str] = None
    status: Optional[str] = "Completed"

class AuditUpdate(BaseModel):
    auditType: Optional[str] = None
    auditDate: Optional[str] = None
    notes: Optional[str] = None
    auditor: Optional[str] = None
    status: Optional[str] = None

class AuditResponse(BaseModel):
    id: str
    assetId: str
    auditType: str
    auditDate: date
    notes: Optional[str] = None
    auditor: Optional[str] = None
    status: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class AuditsListResponse(BaseModel):
    audits: List[Dict]

class AuditDetailResponse(BaseModel):
    audit: Dict

class AuditStatsResponse(BaseModel):
    recentAudits: List[Dict]

