# FastAPI Conversion Status

This document tracks the conversion status of Next.js API routes to FastAPI endpoints, including which pages/components use each API and their integration status.

**Legend:**
- ✅ = Converted to FastAPI
- ❌ = Not yet converted
- 🔗 = Hook integrated with FastAPI
- 📄 = Direct fetch (not using hook)

---

## Summary

| Category | Total Routes | Converted | Not Converted |
|----------|-------------|-----------|---------------|
| Auth | 6 | 6 | 0 |
| Assets (Core) | 3 | 3 | 0 |
| Assets (Actions) | 24 | 15 | 9 |
| Assets (Documents/Media) | 14 | 0 | 14 |
| Categories | 2 | 2 | 0 |
| Subcategories | 2 | 2 | 0 |
| Dashboard | 2 | 2 | 0 |
| Departments | 3 | 2 | 1 |
| Employees | 2 | 2 | 0 |
| Locations | 3 | 2 | 1 |
| Sites | 3 | 2 | 1 |
| Setup | 4 | 1 | 3 |
| Inventory | 9 | 0 | 9 |
| Reports | 21 | 0 | 21 |
| Forms | 4 | 0 | 4 |
| Users | 3 | 0 | 3 |
| Settings | 2 | 0 | 2 |
| Cron Jobs | 3 | 0 | 3 |
| File History | 4 | 0 | 4 |
| Other | 3 | 0 | 3 |
| **TOTAL** | **113** | **38** | **75** |

---

## Hooks Integration Status

| Hook | FastAPI Integrated | Used By |
|------|-------------------|---------|
| `use-assets.ts` | ✅ Yes | Lists, Assets pages, Checkout, Checkin, etc. |
| `use-categories.ts` | ✅ Yes | Setup Categories, Asset forms |
| `use-departments.ts` | ✅ Yes | Setup Departments, Asset forms |
| `use-employees.ts` | ✅ Yes | Employees page, Checkout |
| `use-locations.ts` | ✅ Yes | Setup Locations, Asset forms |
| `use-sites.ts` | ✅ Yes | Setup Sites, Asset forms |
| `use-company-info.ts` | ✅ Yes | Setup Company Info |
| `use-user-profile.ts` | ✅ Yes | Account, Settings |
| `use-permissions.ts` | ❌ No (uses /api/auth/me) | All protected pages |
| `use-mobile.ts` | N/A | Layout |

---

## Detailed Status by API

### Auth `/api/auth/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/auth/login` | POST | ✅ | `auth.py` | `app/login/page.tsx` | 📄 Direct |
| `/api/auth/signup` | POST | ✅ | `auth.py` | `app/signup/page.tsx` | 📄 Direct |
| `/api/auth/logout` | POST | ✅ | `auth.py` | `components/navigation/nav-user.tsx` | 🔗 use-user-profile |
| `/api/auth/me` | GET, PATCH | ✅ | `auth.py` | `components/settings/permissions.tsx`, `hooks/use-permissions.ts` | 📄 Direct + 🔗 use-user-profile |
| `/api/auth/change-password` | POST | ✅ | `auth.py` | `app/account/page.tsx` | 📄 Direct |
| `/api/auth/reset-password` | POST | ✅ | `auth.py` | `app/reset-password/page.tsx` | 📄 Direct |

---

### Assets - Core `/api/assets/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/assets` | GET | ✅ | `assets.py` | `app/lists/assets/page.tsx`, `app/assets/page.tsx`, checkout pages, QR dialogs, schedule dialogs | 🔗 use-assets |
| `/api/assets` | POST | ✅ | `assets.py` | `app/assets/add/page.tsx` | 🔗 use-assets |
| `/api/assets/[id]` | GET | ✅ | `assets.py` | `app/assets/[id]/page.tsx`, `app/assets/details/[id]/page.tsx` | 🔗 use-assets |
| `/api/assets/[id]` | PUT | ✅ | `assets.py` | `app/assets/[id]/page.tsx` | 🔗 use-assets (useUpdateAsset) |
| `/api/assets/[id]` | DELETE | ✅ | `assets.py` | `app/lists/assets/page.tsx`, `app/assets/page.tsx` | 🔗 use-assets (useDeleteAsset) |

---

### Assets - Checkout/Checkin `/api/assets/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/assets/checkout` | POST | ✅ | `checkout.py` | `app/assets/checkout/page.tsx`, `components/checkout-manager.tsx` | 🔗 use-assets (useCreateCheckout) |
| `/api/assets/checkout/stats` | GET | ✅ | `checkout.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/checkout/[checkoutId]` | GET, PATCH | ✅ | `GET /api/assets/checkout/{checkout_id}`, `PATCH /api/assets/checkout/{checkout_id}` | `components/checkout-manager.tsx` | ✅ FastAPI (updated component) |
| `/api/assets/checkin` | POST | ✅ | `checkin.py` | `app/assets/checkin/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/checkin/stats` | GET | ✅ | `checkin.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/[id]/checkout` | GET | ✅ | `GET /api/assets/{asset_id}/checkout` | `components/checkout-manager.tsx` | ✅ FastAPI (updated component) |

---

### Assets - Other Actions `/api/assets/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/assets/dispose` | POST | ✅ | `dispose.py` | `app/assets/dispose/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/dispose/stats` | GET | ✅ | `dispose.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/lease` | POST | ✅ | `lease.py` | `app/assets/lease/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/lease/stats` | GET | ✅ | `lease.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/lease-return` | POST | ✅ | `lease_return.py` | `app/assets/lease-return/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/lease-return/stats` | GET | ✅ | `lease_return.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/maintenance` | POST | ✅ | `maintenance.py` | `app/assets/maintenance/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/maintenance/stats` | GET | ✅ | `maintenance.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/maintenance` | GET | ✅ | `maintenance.py` | `app/assets/[id]/page.tsx` | 🔗 `useAssetMaintenances` |
| `/api/assets/maintenance/[id]` | DELETE | ✅ | `maintenance.py` | `app/assets/[id]/page.tsx` | 🔗 `useDeleteMaintenance` |
| `/api/assets/maintenance/[id]` | GET | ✅ | `GET /api/assets/maintenance/{maintenance_id}` | `app/assets/details/[id]/page.tsx` | ✅ FastAPI |
| `/api/assets/maintenance` | PUT | ✅ | `PUT /api/assets/maintenance` | `app/lists/maintenances/page.tsx` | ✅ FastAPI via `useUpdateMaintenance` |
| `/api/assets/move` | POST | ✅ | `move.py` | `app/assets/move/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/move/stats` | GET | ✅ | `move.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/reserve` | GET, POST | ✅ | `GET /api/assets/reserve?assetId=...`, `POST /api/assets/reserve` | `app/assets/[id]/page.tsx`, `app/assets/details/[id]/page.tsx`, `app/assets/reserve/page.tsx` | ✅ FastAPI (updated pages) |
| `/api/assets/reserve/stats` | GET | ✅ | `reserve.py` | Dashboard | 🔗 via dashboard |
| `/api/assets/reserve/[id]` | DELETE | ✅ | `DELETE /api/assets/reserve/{reservation_id}` | `app/assets/[id]/page.tsx`, `components/checkout-manager.tsx` | ✅ FastAPI (updated pages and component) |
| `/api/assets/schedules` | GET, POST | ✅ | `schedule.py` | `components/dialogs/schedule-dialog.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/schedules/[id]` | GET, PUT, DELETE | ✅ | `schedule.py` | Schedule management | 📄 Direct (Next.js API) |

---

### Assets - Audit `/api/assets/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/assets/[id]/audit` | GET, POST | ✅ | `GET /api/assets/{asset_id}/audit`, `POST /api/assets/{asset_id}/audit` | `components/audit-history-manager.tsx` | ✅ FastAPI (updated component) |
| `/api/assets/audit/[auditId]` | PATCH, DELETE | ✅ | `PATCH /api/assets/audit/{audit_id}`, `DELETE /api/assets/audit/{audit_id}` | `components/audit-history-manager.tsx`, `app/assets/[id]/page.tsx` | ✅ FastAPI (updated components) |
| `/api/assets/audit/stats` | GET | ✅ | `GET /api/assets/audit/stats` | `app/tools/audit/page.tsx` | ✅ FastAPI (updated page) |

---

### Assets - History & Restore `/api/assets/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/assets/[id]/history` | GET | ✅ | `GET /api/assets/{asset_id}/history` | `app/assets/[id]/page.tsx`, `app/assets/details/[id]/page.tsx`, `components/checkout-manager.tsx` | ✅ FastAPI (updated pages and component) |
| `/api/assets/history/[id]` | DELETE | ✅ | `DELETE /api/assets/history/{id}` | `app/assets/[id]/page.tsx` | ✅ FastAPI (updated page) |
| `/api/assets/[id]/restore` | PATCH | ✅ | `PATCH /api/assets/{asset_id}/restore` | `app/tools/trash/page.tsx` | ✅ FastAPI (updated page) |
| `/api/assets/bulk-delete` | POST | ✅ | `assets.py` | `app/assets/page.tsx` | 🔗 `useBulkDeleteAssets` |
| `/api/assets/trash/empty` | DELETE | ✅ | `DELETE /api/assets/trash/empty` | `app/tools/trash/page.tsx` | ✅ FastAPI (updated page) |
| `/api/assets/import` | POST | ✅ | `POST /api/assets/import` | `app/assets/page.tsx`, `app/tools/import/page.tsx` | ✅ FastAPI (updated pages) |

---

### Assets - Documents & Media `/api/assets/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/assets/documents` | GET | ❌ | - | `components/dialogs/document-browser-dialog.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/documents/upload` | POST | ❌ | - | - | 📄 Direct (Next.js API) |
| `/api/assets/documents/[assetTagId]` | GET | ❌ | - | `app/assets/[id]/page.tsx`, `app/assets/details/[id]/page.tsx`, `components/app-header.tsx`, `components/dialogs/asset-media-dialog.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/documents/delete` | DELETE | ❌ | - | - | 📄 Direct (Next.js API) |
| `/api/assets/documents/delete/[id]` | DELETE | ❌ | - | `app/assets/[id]/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/documents/bulk-delete` | DELETE | ❌ | - | - | 📄 Direct (Next.js API) |
| `/api/assets/images/[assetTagId]` | GET | ❌ | - | `app/assets/[id]/page.tsx`, `app/assets/details/[id]/page.tsx`, `components/app-header.tsx`, `components/dialogs/asset-media-dialog.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/images/bulk` | POST | ❌ | - | `app/assets/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/images/delete/[id]` | DELETE | ❌ | - | `app/assets/[id]/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/media` | GET | ❌ | - | `components/dialogs/media-browser-dialog.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/media/upload` | POST | ❌ | - | - | 📄 Direct (Next.js API) |
| `/api/assets/media/delete` | DELETE | ❌ | - | - | 📄 Direct (Next.js API) |
| `/api/assets/media/bulk-delete` | DELETE | ❌ | - | - | 📄 Direct (Next.js API) |
| `/api/assets/upload-document` | POST | ❌ | - | `app/assets/[id]/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/upload-image` | POST | ❌ | - | `app/assets/[id]/page.tsx` | 📄 Direct (Next.js API) |

---

### Assets - PDF Generation `/api/assets/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/assets/[id]/pdf` | GET | ❌ | - | Asset details print | 📄 Direct (Next.js API) |
| `/api/assets/accountability-form/pdf` | POST | ❌ | - | `app/forms/accountability-form/page.tsx` | 📄 Direct (Next.js API) |
| `/api/assets/return-form/pdf` | POST | ❌ | - | `app/forms/return-form/page.tsx` | 📄 Direct (Next.js API) |

---

### Categories `/api/categories/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/categories` | GET, POST | ✅ | `categories.py` | `app/setup/categories/page.tsx`, Asset forms | 🔗 use-categories |
| `/api/categories/[id]` | PUT, DELETE | ✅ | `categories.py` | `app/setup/categories/page.tsx` | 🔗 use-categories |

---

### Subcategories `/api/subcategories/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/subcategories` | GET, POST | ✅ | `GET /api/subcategories`, `POST /api/subcategories` | `hooks/use-categories.ts`, Asset forms | ✅ FastAPI via `useSubCategories`, `useCreateSubCategory` |
| `/api/subcategories/[id]` | PUT, DELETE | ✅ | `PUT /api/subcategories/{id}`, `DELETE /api/subcategories/{id}` | `app/setup/categories/page.tsx` | ✅ FastAPI via `useUpdateSubCategory`, `useDeleteSubCategory` |

---

### Dashboard `/api/dashboard/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/dashboard/stats` | GET | ✅ | `dashboard.py` | `app/dashboard/dashboard-client.tsx` | 🔗 getApiBaseUrl() integrated |
| `/api/dashboard/asset-value-grouped` | GET | ✅ | `dashboard.py` | `components/dashboard/asset-value-chart.tsx` | 🔗 getApiBaseUrl() integrated |

---

### Departments `/api/departments/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/departments` | GET, POST | ✅ | `departments.py` | `app/setup/departments/page.tsx`, Asset forms | 🔗 use-departments |
| `/api/departments/[id]` | PUT, DELETE | ✅ | `departments.py` | `app/setup/departments/page.tsx` | 🔗 use-departments |
| `/api/departments/bulk-delete` | POST | ❌ | - | `app/setup/departments/page.tsx` | 📄 Direct (Next.js API) |

---

### Employees `/api/employees/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/employees` | GET, POST | ✅ | `employees.py` | `app/employees/page.tsx`, Checkout pages | 🔗 use-employees |
| `/api/employees/[id]` | GET, PUT, DELETE | ✅ | `employees.py` | `app/employees/page.tsx` | 🔗 use-employees |

---

### Locations `/api/locations/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/locations` | GET, POST | ✅ | `locations.py` | `app/setup/locations/page.tsx`, Asset forms | 🔗 use-locations |
| `/api/locations/[id]` | PUT, DELETE | ✅ | `locations.py` | `app/setup/locations/page.tsx` | 🔗 use-locations |
| `/api/locations/bulk-delete` | POST | ❌ | - | `app/setup/locations/page.tsx` | 📄 Direct (Next.js API) |

---

### Sites `/api/sites/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/sites` | GET, POST | ✅ | `sites.py` | `app/setup/sites/page.tsx`, Asset forms | 🔗 use-sites |
| `/api/sites/[id]` | PUT, DELETE | ✅ | `sites.py` | `app/setup/sites/page.tsx` | 🔗 use-sites |
| `/api/sites/bulk-delete` | POST | ❌ | - | `app/setup/sites/page.tsx` | 📄 Direct (Next.js API) |

---

### Setup - Company Info `/api/setup/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/setup/company-info` | GET, POST, PUT | ✅ | `company_info.py` | `app/setup/company-info/page.tsx` | 🔗 use-company-info |
| `/api/setup/company-info/upload-logo` | POST | ❌ | - | `app/setup/company-info/page.tsx` | 📄 Direct (Next.js API) |
| `/api/setup/company-info/delete-logo` | DELETE | ❌ | - | `app/setup/company-info/page.tsx` | 📄 Direct (Next.js API) |

---

### Inventory `/api/inventory/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/inventory` | GET, POST | ❌ | - | `app/inventory/page.tsx`, `components/maintenance/inventory-items-selector.tsx`, `components/dialogs/inventory-transaction-dialog.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/[id]` | GET, PUT, DELETE | ❌ | - | `app/inventory/[itemCode]/page.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/[id]/restore` | POST | ❌ | - | `app/inventory/trash/page.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/[id]/transactions` | GET, POST | ❌ | - | `app/inventory/[itemCode]/page.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/[id]/transactions/bulk-delete` | DELETE | ❌ | - | `app/inventory/[itemCode]/page.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/generate-code` | GET | ❌ | - | `components/dialogs/inventory-item-dialog.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/export` | GET | ❌ | - | `app/tools/export/page.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/pdf` | GET | ❌ | - | `app/inventory/page.tsx` | 📄 Direct (Next.js API) |
| `/api/inventory/trash/empty` | DELETE | ❌ | - | `app/inventory/trash/page.tsx` | 📄 Direct (Next.js API) |

---

### Reports `/api/reports/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/reports/assets/summary` | GET | ❌ | - | `app/reports/assets/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/assets/export` | GET | ❌ | - | `app/reports/assets/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/assets/pdf` | GET | ❌ | - | `app/reports/reservation/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/audit` | GET | ❌ | - | `app/reports/audit/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/audit/export` | GET | ❌ | - | `app/reports/audit/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/checkout` | GET | ❌ | - | `app/reports/checkout/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/checkout/export` | GET | ❌ | - | `app/reports/checkout/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/depreciation` | GET | ❌ | - | `app/reports/depreciation/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/depreciation/export` | GET | ❌ | - | `app/reports/depreciation/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/lease` | GET | ❌ | - | `app/reports/lease/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/lease/export` | GET | ❌ | - | `app/reports/lease/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/location` | GET | ❌ | - | `app/reports/location/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/location/export` | GET | ❌ | - | `app/reports/location/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/maintenance` | GET | ❌ | - | `app/reports/maintenance/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/maintenance/export` | GET | ❌ | - | `app/reports/maintenance/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/reservation` | GET | ❌ | - | `app/reports/reservation/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/reservation/export` | GET | ❌ | - | `app/reports/reservation/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/transaction` | GET | ❌ | - | `app/reports/transaction/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/transaction/export` | GET | ❌ | - | `app/reports/transaction/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/automated` | GET, POST | ❌ | - | `app/reports/automated-reports/page.tsx` | 📄 Direct (Next.js API) |
| `/api/reports/automated/[id]` | GET, PUT, DELETE | ❌ | - | `app/reports/automated-reports/page.tsx` | 📄 Direct (Next.js API) |

---

### Forms `/api/forms/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/forms/accountability-form` | GET, POST | ❌ | - | `app/forms/accountability-form/page.tsx` | 📄 Direct (Next.js API) |
| `/api/forms/return-form` | GET, POST | ❌ | - | `app/forms/return-form/page.tsx` | 📄 Direct (Next.js API) |
| `/api/forms/history` | GET | ❌ | - | `app/forms/history/page.tsx` | 📄 Direct (Next.js API) |
| `/api/forms/history/[id]` | GET, DELETE | ❌ | - | `app/forms/history/[id]/page.tsx` | 📄 Direct (Next.js API) |

---

### Users `/api/users/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/users` | GET, POST | ❌ | - | `app/settings/users/page.tsx` | 📄 Direct (Next.js API) |
| `/api/users/[id]` | GET, PUT, DELETE | ❌ | - | `app/settings/users/page.tsx` | 📄 Direct (Next.js API) |
| `/api/users/[id]/send-password-reset` | POST | ❌ | - | `app/settings/users/page.tsx` | 📄 Direct (Next.js API) |

---

### Settings `/api/settings/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/settings/asset-events` | GET, POST | ❌ | - | `app/settings/asset-events/page.tsx` | 📄 Direct (Next.js API) |
| `/api/settings/asset-events/[id]` | PUT, DELETE | ❌ | - | `app/settings/asset-events/page.tsx` | 📄 Direct (Next.js API) |

---

### File History `/api/file-history/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/file-history` | GET | ❌ | - | File history management | 📄 Direct (Next.js API) |
| `/api/file-history/upload` | POST | ❌ | - | File history management | 📄 Direct (Next.js API) |
| `/api/file-history/[id]` | GET, DELETE | ❌ | - | File history management | 📄 Direct (Next.js API) |
| `/api/file-history/[id]/download` | GET | ❌ | - | File history management | 📄 Direct (Next.js API) |

---

### Cron Jobs `/api/cron/*`

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/cron/cleanup-deleted-assets` | POST | ❌ | - | Vercel Cron | N/A (Server-side) |
| `/api/cron/cleanup-deleted-inventory` | POST | ❌ | - | Vercel Cron | N/A (Server-side) |
| `/api/cron/send-scheduled-reports` | POST | ❌ | - | Vercel Cron | N/A (Server-side) |

---

### Other

| Route | Method(s) | Status | FastAPI Router | Pages/Components Using | Integration |
|-------|-----------|--------|----------------|----------------------|-------------|
| `/api/activities` | GET | ❌ | - | `components/dashboard/activity-feed.tsx` | 📄 Direct (Next.js API) |
| `/api/countries` | GET | ❌ | - | `components/fields/country-select-field.tsx` | 📄 Direct (Next.js API) |
| `/api/health` | GET | ❌ | - | Health checks | 📄 Direct (Next.js API) |

---

## Pages Integration Summary

### Fully Integrated with FastAPI Hooks ✅

| Page | Hooks Used |
|------|-----------|
| `app/dashboard/dashboard-client.tsx` | Custom getApiBaseUrl() |
| `app/employees/page.tsx` | use-employees |
| `app/setup/categories/page.tsx` | use-categories |
| `app/setup/departments/page.tsx` | use-departments |
| `app/setup/locations/page.tsx` | use-locations |
| `app/setup/sites/page.tsx` | use-sites |
| `app/setup/company-info/page.tsx` | use-company-info |
| `app/lists/assets/page.tsx` | use-assets |

### Partially Integrated (Hook + Direct fetch) ⚠️

| Page | Issue |
|------|-------|
| `app/assets/[id]/page.tsx` | GET uses hook, PUT/DELETE use direct fetch |
| `app/assets/page.tsx` | List/delete/bulk-delete use hooks, import uses direct fetch |
| `app/setup/departments/page.tsx` | CRUD uses hook, bulk-delete uses direct fetch |
| `app/setup/locations/page.tsx` | CRUD uses hook, bulk-delete uses direct fetch |
| `app/setup/sites/page.tsx` | CRUD uses hook, bulk-delete uses direct fetch |

### Not Integrated (Direct fetch to Next.js API) ❌

| Page | APIs Used |
|------|----------|
| `app/inventory/*` | All inventory APIs |
| `app/reports/*` | All report APIs |
| `app/forms/*` | All form APIs |
| `app/settings/users/page.tsx` | /api/users |
| `app/settings/asset-events/page.tsx` | /api/settings/asset-events |
| `app/tools/trash/page.tsx` | /api/assets restore/delete |
| `app/assets/dispose/page.tsx` | /api/assets/dispose (has FastAPI but uses direct fetch) |
| `app/assets/lease/page.tsx` | /api/assets/lease (has FastAPI but uses direct fetch) |
| `app/assets/lease-return/page.tsx` | /api/assets/lease-return (has FastAPI but uses direct fetch) |
| `app/assets/maintenance/page.tsx` | /api/assets/maintenance (has FastAPI but uses direct fetch) |
| `app/assets/move/page.tsx` | /api/assets/move (has FastAPI but uses direct fetch) |
| `app/assets/reserve/page.tsx` | /api/assets/reserve (has FastAPI but uses direct fetch) |

---

## Priority Tasks

### 1. Update existing pages to use FastAPI hooks
These pages have FastAPI endpoints but still use direct fetch:
- [ ] `app/assets/dispose/page.tsx` - integrate with dispose hook
- [ ] `app/assets/lease/page.tsx` - integrate with lease hook
- [ ] `app/assets/lease-return/page.tsx` - integrate with lease-return hook
- [ ] `app/assets/maintenance/page.tsx` - integrate with maintenance hook
- [ ] `app/assets/move/page.tsx` - integrate with move hook
- [ ] `app/assets/reserve/page.tsx` - integrate with reserve hook
- [ ] `app/assets/checkin/page.tsx` - integrate with checkin hook

### 2. Create FastAPI endpoints for missing routes
High priority:
- [x] `/api/assets/[id]` PUT, DELETE ✅ DONE
- [x] `/api/subcategories/*`
- [ ] `/api/users/*`
- [ ] `/api/assets/[id]/audit`
- [ ] `/api/assets/checkout/[checkoutId]`

### 3. Create hooks for remaining FastAPI endpoints
- [ ] Create use-dispose hook
- [ ] Create use-lease hook
- [ ] Create use-lease-return hook
- [ ] Create use-maintenance hook
- [ ] Create use-move hook
- [ ] Create use-reserve hook
- [ ] Create use-checkin hook

---

*Last updated: December 18, 2025*
