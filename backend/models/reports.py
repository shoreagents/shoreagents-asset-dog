"""
Pydantic models for Reports API
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class StatusGroup(BaseModel):
    status: str
    count: int
    value: float

class CategoryGroup(BaseModel):
    categoryId: str
    categoryName: str
    count: int
    value: float

class LocationGroup(BaseModel):
    location: str
    count: int

class SiteGroup(BaseModel):
    site: str
    count: int

class ReportSummary(BaseModel):
    totalAssets: int
    totalValue: float
    byStatus: List[StatusGroup]
    byCategory: List[CategoryGroup]
    byLocation: List[LocationGroup]
    bySite: List[SiteGroup]

class RecentAsset(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    assetTagId: str
    description: str
    status: Optional[str] = None
    cost: Optional[float] = None
    category: Optional[Dict[str, str]] = None
    location: Optional[str] = None
    site: Optional[str] = None
    department: Optional[str] = None

class PaginationInfo(BaseModel):
    total: int
    page: int
    pageSize: int
    totalPages: int
    hasNextPage: bool
    hasPreviousPage: bool

class AuditItem(BaseModel):
    id: str
    assetTagId: str
    category: Optional[str] = None
    subCategory: Optional[str] = None
    auditName: str
    auditedToSite: Optional[str] = None
    auditedToLocation: Optional[str] = None
    lastAuditDate: str
    auditBy: Optional[str] = None

class AuditReportResponse(BaseModel):
    audits: List[AuditItem]
    pagination: PaginationInfo

class ReportDataResponse(BaseModel):
    summary: ReportSummary
    recentAssets: List[RecentAsset]
    generatedAt: str

class EmployeeGroup(BaseModel):
    employeeId: str
    employeeName: str
    employeeEmail: str
    department: Optional[str] = None
    count: int
    overdueCount: int

class DepartmentGroup(BaseModel):
    department: str
    count: int
    overdueCount: int
    employeeCount: int

class CheckoutSummary(BaseModel):
    totalActive: int
    totalOverdue: int
    totalHistorical: int
    byEmployee: List[EmployeeGroup]
    byDepartment: List[DepartmentGroup]

class CheckoutItem(BaseModel):
    id: str
    assetId: str
    assetTagId: str
    assetDescription: str
    assetStatus: Optional[str] = None
    assetCost: Optional[float] = None
    category: Optional[str] = None
    subCategory: Optional[str] = None
    checkoutDate: str
    expectedReturnDate: Optional[str] = None
    returnDate: Optional[str] = None
    isOverdue: bool
    employeeId: Optional[str] = None
    employeeName: str
    employeeEmail: str
    employeeDepartment: Optional[str] = None
    location: Optional[str] = None
    site: Optional[str] = None

class CheckoutReportResponse(BaseModel):
    summary: CheckoutSummary
    checkouts: List[CheckoutItem]
    generatedAt: str
    pagination: PaginationInfo

class DepreciationAsset(BaseModel):
    id: str
    assetTagId: str
    description: str
    category: Optional[str] = None
    subCategory: Optional[str] = None
    originalCost: Optional[float] = None
    depreciableCost: Optional[float] = None
    salvageValue: Optional[float] = None
    assetLifeMonths: Optional[int] = None
    depreciationMethod: Optional[str] = None
    dateAcquired: Optional[str] = None
    location: Optional[str] = None
    site: Optional[str] = None
    isDepreciable: bool
    monthlyDepreciation: float
    annualDepreciation: float
    accumulatedDepreciation: float
    currentValue: float
    depreciationYears: int
    depreciationMonths: int

class DepreciationReportResponse(BaseModel):
    assets: List[DepreciationAsset]
    pagination: PaginationInfo

class LeaseItem(BaseModel):
    id: str
    assetTagId: str
    description: str
    category: Optional[str] = None
    subCategory: Optional[str] = None
    lessee: str
    leaseStartDate: str
    leaseEndDate: Optional[str] = None
    conditions: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    site: Optional[str] = None
    assetStatus: Optional[str] = None
    assetCost: Optional[float] = None
    leaseStatus: str
    daysRemaining: Optional[int] = None
    lastReturnDate: Optional[str] = None
    returnCondition: Optional[str] = None
    createdAt: str

class LeaseReportResponse(BaseModel):
    leases: List[LeaseItem]
    pagination: PaginationInfo

class LocationGroup(BaseModel):
    location: str
    assetCount: int
    totalValue: float
    averageValue: float
    utilizationPercentage: float

class SiteGroup(BaseModel):
    site: str
    assetCount: int
    totalValue: float
    locationCount: int
    averageValue: float
    utilizationPercentage: float

class LocationSummary(BaseModel):
    totalAssets: int
    totalLocations: int
    totalSites: int
    byLocation: List[LocationGroup]
    bySite: List[SiteGroup]

class LocationAsset(BaseModel):
    id: str
    assetTagId: str
    description: str
    status: Optional[str] = None
    cost: Optional[float] = None
    category: Optional[str] = None
    location: Optional[str] = None
    site: Optional[str] = None
    department: Optional[str] = None
    lastMoveDate: Optional[str] = None

class MovementItem(BaseModel):
    id: str
    assetTagId: str
    assetDescription: str
    moveType: str
    moveDate: str
    employeeName: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class LocationReportResponse(BaseModel):
    summary: LocationSummary
    assets: List[LocationAsset]
    movements: List[MovementItem]
    generatedAt: str
    pagination: PaginationInfo

class MaintenanceInventoryItem(BaseModel):
    id: str
    inventoryItemId: str
    quantity: int
    unitCost: Optional[float] = None
    inventoryItem: dict  # Will contain itemCode, name, unit, unitCost

class MaintenanceItem(BaseModel):
    id: str
    assetId: str
    assetTagId: str
    assetDescription: str
    assetStatus: Optional[str] = None
    assetCost: Optional[float] = None
    category: Optional[str] = None
    title: str
    details: Optional[str] = None
    status: str
    dueDate: Optional[str] = None
    dateCompleted: Optional[str] = None
    dateCancelled: Optional[str] = None
    maintenanceBy: Optional[str] = None
    cost: Optional[float] = None
    isRepeating: bool
    isOverdue: bool
    isUpcoming: bool
    inventoryItems: Optional[List[MaintenanceInventoryItem]] = None

class UpcomingMaintenance(BaseModel):
    id: str
    assetId: str
    assetTagId: str
    assetDescription: str
    title: str
    dueDate: Optional[str] = None
    maintenanceBy: Optional[str] = None
    daysUntilDue: Optional[int] = None

class StatusGroup(BaseModel):
    status: str
    count: int
    totalCost: float
    averageCost: float

class TotalCostByStatus(BaseModel):
    completed: float
    scheduled: float
    cancelled: float
    inProgress: float

class MaintenanceSummary(BaseModel):
    totalMaintenances: int
    underRepair: int
    upcoming: int
    completed: int
    totalCost: float
    averageCost: float
    totalCostByStatus: TotalCostByStatus
    byStatus: List[StatusGroup]

class MaintenanceReportResponse(BaseModel):
    summary: MaintenanceSummary
    maintenances: List[MaintenanceItem]
    upcoming: List[UpcomingMaintenance]
    generatedAt: str
    pagination: PaginationInfo

class ReservationItem(BaseModel):
    id: str
    assetTagId: str
    description: str
    category: Optional[str] = None
    subCategory: Optional[str] = None
    reservationType: str
    reservationDate: str
    purpose: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    site: Optional[str] = None
    assetStatus: Optional[str] = None
    assetCost: Optional[float] = None
    department: Optional[str] = None
    employeeName: Optional[str] = None
    employeeEmail: Optional[str] = None
    reservationStatus: str
    daysUntil: int
    createdAt: str

class ReservationReportResponse(BaseModel):
    reservations: List[ReservationItem]
    pagination: PaginationInfo

class TransactionTypeGroup(BaseModel):
    type: str
    count: int
    totalValue: float

class TransactionSummary(BaseModel):
    totalTransactions: int
    byType: List[TransactionTypeGroup]

class TransactionItem(BaseModel):
    id: str
    transactionType: str
    assetTagId: str
    assetDescription: str
    category: Optional[str] = None
    subCategory: Optional[str] = None
    transactionDate: str
    actionBy: Optional[str] = None
    details: Optional[str] = None
    location: Optional[str] = None
    site: Optional[str] = None
    department: Optional[str] = None
    assetCost: Optional[float] = None
    # Edit Asset specific fields
    fieldChanged: Optional[str] = None
    oldValue: Optional[str] = None
    newValue: Optional[str] = None
    # Lease Out specific fields
    lessee: Optional[str] = None
    leaseStartDate: Optional[str] = None
    leaseEndDate: Optional[str] = None
    conditions: Optional[str] = None
    # Lease Return specific fields
    returnDate: Optional[str] = None
    condition: Optional[str] = None
    notes: Optional[str] = None
    # Repair Asset specific fields
    title: Optional[str] = None
    maintenanceBy: Optional[str] = None
    dueDate: Optional[str] = None
    status: Optional[str] = None
    cost: Optional[float] = None
    dateCompleted: Optional[str] = None
    # Move Asset specific fields
    moveType: Optional[str] = None
    moveDate: Optional[str] = None
    employeeName: Optional[str] = None
    reason: Optional[str] = None
    fromLocation: Optional[str] = None
    toLocation: Optional[str] = None
    # Checkout Asset specific fields
    checkoutDate: Optional[str] = None
    expectedReturnDate: Optional[str] = None
    isOverdue: Optional[bool] = None
    # Checkin Asset specific fields
    checkinDate: Optional[str] = None
    # Disposal specific fields
    disposeDate: Optional[str] = None
    disposeReason: Optional[str] = None
    disposeValue: Optional[float] = None

class TransactionReportResponse(BaseModel):
    transactions: List[TransactionItem]
    summary: TransactionSummary
    generatedAt: str
    pagination: PaginationInfo

