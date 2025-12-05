# Asset History Logging Recommendations

## Overview
This document provides recommendations on what operations and field changes should be logged in `assets_history_logs` for optimal audit trail, compliance, and asset tracking.

---

## Priority Levels

### 🔴 **CRITICAL** - Must Log (High Business Value)
These operations are essential for audit compliance, security, and accountability.

### 🟡 **IMPORTANT** - Should Log (Medium Business Value)
These operations provide valuable tracking and help with asset management.

### 🟢 **OPTIONAL** - Nice to Have (Low Business Value)
These operations are useful but not critical for core functionality.

---

## Recommended History Logging

### 🔴 **1. Asset Lifecycle Events**

#### **Asset Creation** (`eventType: 'added'`)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🔴 CRITICAL

**Why:** 
- Complete audit trail from asset inception
- Required for transaction reports (currently shows `actionBy: null`)
- Compliance requirement for asset tracking

**Implementation:** ✅ Implemented in `app/api/assets/route.ts` POST method
- Creates history log with `eventType: 'added'` when assets are created
- Tracks who created the asset (`actionBy`)
- Uses transaction to ensure atomicity

**Fields to Log:** None (just creation event)

---

#### **Asset Deletion** (`eventType: 'deleted'`)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🔴 CRITICAL

**Why:**
- Critical for audit compliance
- Tracks who deleted assets and when
- Required for compliance reporting

**Current Implementation:** ✅ Working correctly

---

#### **Asset Disposal** (`eventType: 'edited'`)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🔴 CRITICAL

**Why:**
- Disposal is a critical financial event
- Required for accounting and compliance
- Tracks disposal method, value, and reason

**Implementation:** ✅ Implemented in `app/api/assets/dispose/route.ts`
- Logs status change to disposal method ("Sold", "Donated", "Scrapped", etc.)
- Logs location clearing (if location was set)
- Logs department clearing (if department was set)
- Logs site clearing (if site was set)
- Uses dispose date as `eventDate`
- All logs created in transaction for atomicity

**Fields Logged:**
- Status change (to disposal method)
- Location clearing (if applicable)
- Department clearing (if applicable)
- Site clearing (if applicable)

---

### 🔴 **2. Status Changes**

#### **Checkout Operations** (`eventType: 'edited'`)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🔴 CRITICAL

**Why:**
- Status changes from "Available" → "Checked out"
- Tracks asset assignment to employees
- Critical for accountability and asset location tracking

**Implementation:** ✅ Implemented in `app/api/assets/checkout/route.ts`
- Logs status change to "Checked out" (if different from current status)
- Logs location change (if provided and different)
- Logs department change (if provided and different)
- Logs site change (if provided and different)
- Uses checkout date as `eventDate`
- All logs created in transaction for atomicity

**Fields Logged:**
- Status change (to "Checked out")
- Location change (if provided)
- Department change (if provided)
- Site change (if provided)

---

#### **Checkin Operations** (`eventType: 'edited'`)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🔴 CRITICAL

**Why:**
- Status changes from "Checked out" → "Available"
- Completes the checkout lifecycle
- Tracks asset return

**Implementation:** ✅ Implemented in `app/api/assets/checkin/route.ts`
- Logs status change from "Checked out" to "Available"
- Logs location change (if return location provided and different)
- Uses checkin date as `eventDate`
- All logs created in transaction for atomicity

**Fields Logged:**
- Status change (to "Available")
- Location change (if return location provided)

---

### 🟡 **3. Location & Assignment Changes**

#### **Location Transfers** (via Move)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🟡 IMPORTANT

**Current Implementation:** ✅ Working correctly

---

#### **Department Transfers** (via Move)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🟡 IMPORTANT

**Current Implementation:** ✅ Working correctly

---

#### **Employee Assignment** (via Move)
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🟡 IMPORTANT

**Implementation:** ✅ Implemented in `app/api/assets/move/route.ts`
- Logs employee reassignment when updating existing checkout
- Uses field name `assignedEmployee` to track the change
- Shows old employee name → new employee name
- Only logs when employee actually changes
- Uses move date as `eventDate`
- Also logs status change when creating new checkout (if no active checkout exists)

**Fields Logged:**
- Employee reassignment (`assignedEmployee` field)
- Status change (if new checkout created)

---

### 🟡 **4. Financial Changes**

#### **Cost Changes**
**Current Status:** ✅ IMPLEMENTED (via edit)  
**Priority:** 🟡 IMPORTANT

**Current Implementation:** ✅ Logged when edited via PUT endpoint

**Recommendation:** Consider adding special handling for cost changes:
- Log cost changes separately with more detail
- Include reason/notes if available
- Track cost adjustments vs. initial cost

---

#### **Depreciation Changes**
**Current Status:** ✅ IMPLEMENTED (via edit)  
**Priority:** 🟡 IMPORTANT

**Current Implementation:** ✅ Logged when edited via PUT endpoint

**Fields Currently Logged:**
- `depreciableAsset`
- `depreciableCost`
- `salvageValue`
- `assetLifeMonths`
- `depreciationMethod`

**Recommendation:** ✅ Current implementation is sufficient

---

### 🟡 **5. Lease Operations**

#### **Lease Start**
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🟡 IMPORTANT

**Why:**
- Lease is a significant financial/legal event
- Tracks asset availability and status
- May affect asset status

**Implementation:** ✅ Implemented in `app/api/assets/lease/route.ts`
- Logs status change to "Leased" (if different from current status)
- Uses lease start date as `eventDate`
- Tracks who created the lease (`actionBy`)
- Created in transaction for atomicity

**Fields Logged:**
- Status change (to "Leased")

---

#### **Lease Return**
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🟡 IMPORTANT

**Why:**
- Completes lease lifecycle
- Returns asset to available status
- Tracks lease completion

**Implementation:** ✅ Implemented in `app/api/assets/lease-return/route.ts`
- Logs status change from "Leased" to "Available" (if different from current status)
- Uses return date as `eventDate`
- Tracks who processed the return (`actionBy`)
- Created in transaction for atomicity

**Fields Logged:**
- Status change (to "Available")

---

### 🟢 **6. Critical Field Changes** (Already Implemented)

#### **Asset Tag ID Changes**
**Current Status:** ✅ IMPLEMENTED (via edit)  
**Priority:** 🟢 OPTIONAL (but tracked)

**Why:**
- Asset tag is a critical identifier
- Changes should be tracked for audit purposes

**Current Implementation:** ✅ Logged when edited

---

#### **Serial Number Changes**
**Current Status:** ✅ IMPLEMENTED (via edit)  
**Priority:** 🟢 OPTIONAL (but tracked)

**Why:**
- Serial number is a unique identifier
- Changes should be tracked

**Current Implementation:** ✅ Logged when edited

---

### 🟢 **7. Other Operations**

#### **Maintenance Operations**
**Current Status:** ✅ IMPLEMENTED  
**Priority:** 🟢 OPTIONAL

**Why:**
- Maintenance changes asset status based on maintenance status
- Has its own tracking table (`AssetsMaintenance`)
- Status changes affect asset availability

**Implementation:** ✅ Implemented in `app/api/assets/maintenance/route.ts`
- Logs status change when maintenance is created (POST)
  - "Scheduled" or "In progress" → asset status changes to "Maintenance"
  - "Completed" or "Cancelled" → asset status changes to "Available"
- Logs status change when maintenance status is updated (PUT)
  - Only logs when maintenance status changes AND asset status changes
  - Uses appropriate date (dateCompleted, dateCancelled, or dueDate) as `eventDate`
- All logs created in transaction for atomicity

**Fields Logged:**
- Status change (when maintenance status affects asset status)

---

#### **Reservation Operations**
**Current Status:** ⚪ NOT IMPLEMENTED (By Design)  
**Priority:** 🟢 OPTIONAL

**Why:**
- Reservations are temporary holds
- Don't change asset ownership, location, or status
- Has its own tracking table (`AssetsReserve`)

**Decision:** Not implemented - Reservations don't modify asset fields or status, so history logging is not necessary. The reservation system tracks these operations separately.

---

## Summary of Recommendations

### ✅ **Currently Implemented**
- Asset deletion (soft & hard) ✅
- Asset creation (`eventType: 'added'`) ✅
- Asset editing (all fields) ✅
- Checkout operations (status change + location/department/site changes) ✅
- Checkin operations (status change + location change) ✅
- Disposal operations (status change + field clearing) ✅
- Location/department transfers (via move) ✅
- Lease start (status change to "Leased") ✅
- Lease return (status change to "Available") ✅
- Employee reassignment (via move) ✅

### 🔴 **Critical - Completed** ✅
1. **Asset creation** - ✅ Implemented with `eventType: 'added'` log
2. **Checkout operations** - ✅ Implemented status change to "Checked out" + field changes
3. **Checkin operations** - ✅ Implemented status change to "Available" + location change
4. **Disposal operations** - ✅ Implemented status change and field clearing

### 🟡 **Important - Completed** ✅
1. **Lease start** - ✅ Implemented status change to "Leased"
2. **Lease return** - ✅ Implemented status change to "Available"
3. **Employee reassignment** - ✅ Implemented when updating existing checkout

### 🟢 **Optional - Nice to Have**
1. **Maintenance status changes** - Only if maintenance affects asset status
2. **Bulk operation tracking** - Log bulk imports/updates/deletes

---

## Implementation Status

### Phase 1: Critical Operations ✅ **COMPLETED**
1. ✅ Asset creation logging - Implemented in `app/api/assets/route.ts`
2. ✅ Checkout status change logging - Implemented in `app/api/assets/checkout/route.ts`
3. ✅ Checkin status change logging - Implemented in `app/api/assets/checkin/route.ts`
4. ✅ Disposal logging - Implemented in `app/api/assets/dispose/route.ts`

### Phase 2: Important Operations ✅ **COMPLETED**
1. ✅ Lease start/return logging - Implemented in `app/api/assets/lease/route.ts` and `app/api/assets/lease-return/route.ts`
2. ✅ Employee reassignment logging - Implemented in `app/api/assets/move/route.ts`

### Phase 3: Enhancements ✅ **PARTIALLY COMPLETED**
1. Enhanced cost change logging - Consider adding reason/notes for cost adjustments (Future)
2. Bulk operation tracking - Log bulk imports/updates/deletes (Future)
3. ✅ Maintenance status change logging - Implemented in `app/api/assets/maintenance/route.ts`

---

## Benefits of Complete History Logging

### 1. **Complete Audit Trail**
- Every asset change is tracked
- Full accountability for all operations
- Compliance-ready reporting

### 2. **Better Transaction Reports**
- Accurate "Action By" for all operations
- Complete transaction history
- Better filtering and reporting

### 3. **Asset Lifecycle Tracking**
- See complete journey of each asset
- Track status changes over time
- Understand asset utilization patterns

### 4. **Compliance & Security**
- Meet audit requirements
- Track who did what and when
- Detect unauthorized changes

### 5. **Troubleshooting**
- Easier to debug issues
- Understand why assets are in certain states
- Track down missing assets

---

## Notes on Implementation

### Event Types
Consider adding new event types:
- `'added'` - Asset creation
- `'edited'` - Field changes
- `'deleted'` - Asset deletion
- `'disposed'` - Asset disposal (or use 'edited' with status change)
- `'checked_out'` - Checkout operation (or use 'edited' with status change)
- `'checked_in'` - Checkin operation (or use 'edited' with status change)
- `'leased'` - Lease start (or use 'edited' with status change)
- `'lease_returned'` - Lease return (or use 'edited' with status change)

**Recommendation:** Keep using `'edited'` for status changes to maintain consistency, but ensure all status changes are logged.

### Performance Considerations
- History logs are indexed for fast queries
- Consider archiving old history logs if volume becomes an issue
- Batch operations should create batch history logs

### Data Integrity
- Always create history logs in the same transaction as asset updates
- Use `eventDate` to match operation dates (not `createdAt`)
- Ensure `actionBy` is always populated

---

## Conclusion

The most useful operations to log are:

1. **Asset lifecycle events** (creation, deletion, disposal) - Critical for audit
2. **Status changes** (checkout, checkin, lease) - Critical for tracking asset state
3. **Location/assignment changes** - Important for asset tracking
4. **Financial changes** - Important for accounting compliance
5. **Critical field changes** (asset tag, serial number) - Important for identification

Focus on implementing Phase 1 (Critical Operations) first, as these provide the most value for audit compliance and asset tracking.

