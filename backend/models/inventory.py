"""
Pydantic models for Inventory API
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class InventoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    itemCode: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    currentStock: Decimal
    minStockLevel: Optional[Decimal] = None
    maxStockLevel: Optional[Decimal] = None
    unitCost: Optional[Decimal] = None
    location: Optional[str] = None
    supplier: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    remarks: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    _count: Optional[dict] = None
    isDeleted: Optional[bool] = False
    deletedAt: Optional[datetime] = None

class InventoryItemCreate(BaseModel):
    itemCode: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    currentStock: Optional[Decimal] = 0
    minStockLevel: Optional[Decimal] = None
    maxStockLevel: Optional[Decimal] = None
    unitCost: Optional[Decimal] = None
    location: Optional[str] = None
    supplier: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    remarks: Optional[str] = None

class PaginationInfo(BaseModel):
    total: int
    page: int
    pageSize: int
    totalPages: int
    hasNextPage: bool
    hasPreviousPage: bool

class InventoryItemsResponse(BaseModel):
    items: List[InventoryItem]
    pagination: PaginationInfo

class InventoryItemResponse(BaseModel):
    item: InventoryItem

class InventoryItemUpdate(BaseModel):
    itemCode: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    minStockLevel: Optional[Decimal] = None
    maxStockLevel: Optional[Decimal] = None
    unitCost: Optional[Decimal] = None
    location: Optional[str] = None
    supplier: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    remarks: Optional[str] = None

class InventoryTransaction(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    inventoryItemId: str
    transactionType: str
    quantity: Decimal
    unitCost: Optional[Decimal] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    actionBy: str
    transactionDate: datetime
    relatedTransactionId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    relatedTransaction: Optional['InventoryTransaction'] = None
    inventoryItem: Optional[dict] = None

class InventoryTransactionCreate(BaseModel):
    transactionType: str
    quantity: Decimal
    unitCost: Optional[Decimal] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    destinationItemId: Optional[str] = None

class InventoryTransactionsResponse(BaseModel):
    transactions: List[InventoryTransaction]
    pagination: PaginationInfo

class InventoryTransactionResponse(BaseModel):
    transaction: InventoryTransaction

class BulkDeleteTransactionsRequest(BaseModel):
    transactionIds: List[str]

class BulkDeleteTransactionsResponse(BaseModel):
    success: bool
    deletedCount: int
    message: str

class RestoreResponse(BaseModel):
    success: bool
    message: str
    item: InventoryItem

class BulkRestoreRequest(BaseModel):
    ids: List[str]

class BulkRestoreResponse(BaseModel):
    success: bool
    restoredCount: int
    message: str


class BulkDeleteItemsRequest(BaseModel):
    ids: List[str]
    permanent: bool = True


class BulkDeleteItemsResponse(BaseModel):
    success: bool
    deletedCount: int
    message: str


class GenerateCodeResponse(BaseModel):
    itemCode: str


class EmptyTrashResponse(BaseModel):
    success: bool
    message: str
    deletedCount: int


class InventoryExportSummary(BaseModel):
    totalItems: int
    totalStock: float
    totalCost: float


class InventoryCategoryGroup(BaseModel):
    category: str
    count: int
    totalStock: float
    totalCost: float


class InventoryStatusGroup(BaseModel):
    status: str
    count: int
    totalStock: float
    totalCost: float


class InventoryLowStockItem(BaseModel):
    itemCode: str
    name: str
    currentStock: float
    minStockLevel: Optional[float] = None

class CheckItemCodesRequest(BaseModel):
    itemCodes: List[str]

class CheckItemCodesResponse(BaseModel):
    existingCodes: List[str]

