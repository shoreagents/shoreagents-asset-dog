"""
Pydantic models for File History API
"""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class FileHistoryCreate(BaseModel):
    operationType: str
    fileName: str
    filePath: Optional[str] = None
    fileSize: Optional[int] = None
    mimeType: Optional[str] = None
    recordsProcessed: Optional[int] = None
    recordsCreated: Optional[int] = None
    recordsSkipped: Optional[int] = None
    recordsFailed: Optional[int] = None
    recordsExported: Optional[int] = None
    fieldsExported: Optional[int] = None
    status: str
    errorMessage: Optional[str] = None
    metadata: Optional[Dict] = None

class FileHistoryResponse(BaseModel):
    id: str
    operationType: str
    fileName: str
    filePath: Optional[str] = None
    fileSize: Optional[int] = None
    mimeType: Optional[str] = None
    userId: str
    userEmail: Optional[str] = None
    recordsProcessed: Optional[int] = None
    recordsCreated: Optional[int] = None
    recordsSkipped: Optional[int] = None
    recordsFailed: Optional[int] = None
    recordsExported: Optional[int] = None
    fieldsExported: Optional[int] = None
    status: str
    errorMessage: Optional[str] = None
    metadata: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class FileHistoryListResponse(BaseModel):
    fileHistory: List[FileHistoryResponse]
    pagination: Dict

class FileUploadResponse(BaseModel):
    filePath: str
    fileName: str
    fileSize: int
    mimeType: Optional[str] = None
    publicUrl: Optional[str] = None

