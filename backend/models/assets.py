"""
Pydantic models for Assets API
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class CategoryInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str

class SubCategoryInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str

class EmployeeInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    email: str

class CheckoutInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    checkoutDate: datetime
    expectedReturnDate: Optional[datetime] = None
    employeeUser: Optional[EmployeeInfo] = None

class LeaseInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    leaseStartDate: datetime
    leaseEndDate: Optional[datetime] = None
    lessee: Optional[str] = None

class AuditHistoryInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    auditDate: datetime
    auditType: Optional[str] = None
    auditor: Optional[str] = None

class Asset(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    assetTagId: str
    description: str
    purchasedFrom: Optional[str] = None
    purchaseDate: Optional[datetime] = None
    brand: Optional[str] = None
    cost: Optional[Decimal] = None
    model: Optional[str] = None
    serialNo: Optional[str] = None
    additionalInformation: Optional[str] = None
    xeroAssetNo: Optional[str] = None
    owner: Optional[str] = None
    pbiNumber: Optional[str] = None
    status: Optional[str] = None
    issuedTo: Optional[str] = None
    poNumber: Optional[str] = None
    paymentVoucherNumber: Optional[str] = None
    assetType: Optional[str] = None
    deliveryDate: Optional[datetime] = None
    unaccountedInventory: Optional[bool] = False
    remarks: Optional[str] = None
    qr: Optional[str] = None
    oldAssetTag: Optional[str] = None
    depreciableAsset: Optional[bool] = False
    depreciableCost: Optional[Decimal] = None
    salvageValue: Optional[Decimal] = None
    assetLifeMonths: Optional[int] = None
    depreciationMethod: Optional[str] = None
    dateAcquired: Optional[datetime] = None
    categoryId: Optional[str] = None
    category: Optional[CategoryInfo] = None
    subCategoryId: Optional[str] = None
    subCategory: Optional[SubCategoryInfo] = None
    department: Optional[str] = None
    site: Optional[str] = None
    location: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    deletedAt: Optional[datetime] = None
    isDeleted: bool = False
    checkouts: Optional[List[CheckoutInfo]] = None
    leases: Optional[List[LeaseInfo]] = None
    auditHistory: Optional[List[AuditHistoryInfo]] = None
    imagesCount: Optional[int] = 0

class AssetCreate(BaseModel):
    assetTagId: str
    description: str
    purchasedFrom: Optional[str] = None
    purchaseDate: Optional[str] = None  # Will be parsed to datetime
    brand: Optional[str] = None
    cost: Optional[float] = None
    model: Optional[str] = None
    serialNo: Optional[str] = None
    additionalInformation: Optional[str] = None
    xeroAssetNo: Optional[str] = None
    owner: Optional[str] = None
    pbiNumber: Optional[str] = None
    status: Optional[str] = "Available"
    issuedTo: Optional[str] = None
    poNumber: Optional[str] = None
    paymentVoucherNumber: Optional[str] = None
    assetType: Optional[str] = None
    deliveryDate: Optional[str] = None  # Will be parsed to datetime
    unaccountedInventory: Optional[bool] = False
    remarks: Optional[str] = None
    qr: Optional[str] = None
    oldAssetTag: Optional[str] = None
    depreciableAsset: Optional[bool] = False
    depreciableCost: Optional[float] = None
    salvageValue: Optional[float] = None
    assetLifeMonths: Optional[int] = None
    depreciationMethod: Optional[str] = None
    dateAcquired: Optional[str] = None  # Will be parsed to datetime
    categoryId: Optional[str] = None
    subCategoryId: Optional[str] = None
    department: Optional[str] = None
    site: Optional[str] = None
    location: Optional[str] = None

class AssetUpdate(BaseModel):
    """Model for updating an asset - all fields optional"""
    assetTagId: Optional[str] = None
    description: Optional[str] = None
    purchasedFrom: Optional[str] = None
    purchaseDate: Optional[str] = None  # Will be parsed to datetime
    brand: Optional[str] = None
    cost: Optional[float] = None
    model: Optional[str] = None
    serialNo: Optional[str] = None
    additionalInformation: Optional[str] = None
    xeroAssetNo: Optional[str] = None
    owner: Optional[str] = None
    pbiNumber: Optional[str] = None
    status: Optional[str] = None
    issuedTo: Optional[str] = None
    poNumber: Optional[str] = None
    paymentVoucherNumber: Optional[str] = None
    assetType: Optional[str] = None
    deliveryDate: Optional[str] = None  # Will be parsed to datetime
    unaccountedInventory: Optional[bool] = None
    remarks: Optional[str] = None
    qr: Optional[str] = None
    oldAssetTag: Optional[str] = None
    depreciableAsset: Optional[bool] = None
    depreciableCost: Optional[float] = None
    salvageValue: Optional[float] = None
    assetLifeMonths: Optional[int] = None
    depreciationMethod: Optional[str] = None
    dateAcquired: Optional[str] = None  # Will be parsed to datetime
    categoryId: Optional[str] = None
    subCategoryId: Optional[str] = None
    department: Optional[str] = None
    site: Optional[str] = None
    location: Optional[str] = None

class DeleteResponse(BaseModel):
    success: bool
    message: str

class BulkDeleteRequest(BaseModel):
    ids: List[str]
    permanent: bool = False

class BulkDeleteResponse(BaseModel):
    success: bool
    deletedCount: int
    message: str

class PaginationInfo(BaseModel):
    page: int
    pageSize: int
    total: int
    totalPages: int

class SummaryInfo(BaseModel):
    totalAssets: int
    totalValue: float
    availableAssets: int
    checkedOutAssets: int

class AssetsResponse(BaseModel):
    assets: List[Asset]
    pagination: PaginationInfo
    summary: SummaryInfo

class AssetResponse(BaseModel):
    asset: Asset

class StatusesResponse(BaseModel):
    statuses: List[str]

class SummaryResponse(BaseModel):
    summary: SummaryInfo

