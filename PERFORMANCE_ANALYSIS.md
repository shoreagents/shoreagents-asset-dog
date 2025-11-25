# Performance Optimization Analysis

## 🔍 Current Status

### ✅ Already Optimized
- **Dashboard Stats** - Redis cached (15s TTL), RSC
- **Activities** - Redis cached (10s TTL), RSC  
- **Categories/Locations/Sites/Departments** - In-memory cached (10min TTL)
- **User Profile** - React Query with shared cache (`useUserProfile`)
- **Company Info** - React Query cached (5min TTL)

---

## 🔴 HIGH PRIORITY - Needs Redis Caching

### 1. **`/api/assets/route.ts`** ⚠️ CRITICAL
**Current:** No caching, heavy queries (findMany, count, aggregate)
**Impact:** Most frequently accessed endpoint
**Queries:**
- `prisma.assets.findMany()` with complex filters
- `prisma.assets.count()` 
- `prisma.assets.aggregate()` for totalValue
- Multiple status counts

**Recommendation:**
- Add Redis cache with 10-15 second TTL
- Cache key: `assets-${page}-${pageSize}-${search}-${category}-${status}`
- Invalidate on asset create/update/delete

### 2. **`/api/assets/[id]/route.ts`** ⚠️ CRITICAL
**Current:** No caching, complex nested queries
**Impact:** Heavy queries with multiple includes (checkouts, leases, auditHistory)
**Queries:**
- `prisma.assets.findFirst()` with deep includes
- Multiple nested relations

**Recommendation:**
- Add Redis cache with 30 second TTL
- Cache key: `asset-details-${id}`
- Invalidate on asset update

### 3. **`/api/employees/route.ts`**
**Current:** No caching
**Impact:** Employee listing with search/filter
**Queries:**
- `prisma.employeeUser.findMany()` with pagination
- Search across name, email, department

**Recommendation:**
- Add Redis cache with 30 second TTL
- Cache key: `employees-${page}-${pageSize}-${search}-${searchType}`

### 4. **`/api/forms/history/route.ts`**
**Current:** No caching
**Impact:** Form history listing with complex queries
**Queries:**
- Multiple form type queries (returnForm, accountabilityForm)
- Counts and data fetching

**Recommendation:**
- Add Redis cache with 15 second TTL
- Cache key: `forms-history-${formType}-${page}-${pageSize}-${search}`

### 5. **Stats Routes** (Multiple)
**Current:** No caching
**Files:**
- `/api/assets/checkout/stats/route.ts`
- `/api/assets/checkin/stats/route.ts`
- `/api/assets/reserve/stats/route.ts`
- `/api/assets/move/stats/route.ts`
- `/api/assets/lease/stats/route.ts`
- `/api/assets/lease-return/stats/route.ts`
- `/api/assets/dispose/stats/route.ts`
- `/api/assets/maintenance/stats/route.ts`

**Recommendation:**
- Add Redis cache with 30 second TTL for all stats routes
- Cache key: `stats-${type}`

---

## 🟡 MEDIUM PRIORITY - Convert to RSC

### Pages Currently Client Components (Fetch via API)

#### 1. **`/app/assets/page.tsx`**
**Current:** `'use client'`, fetches via `/api/assets`
**Recommendation:** Convert to RSC
- Create `lib/data/assets.ts` (like `dashboard-stats.ts`)
- Server Component fetches directly
- Pass initialData to client component
- Add `loading.tsx` for instant navigation

#### 2. **`/app/lists/assets/page.tsx`**
**Current:** `'use client'`, fetches via `/api/assets`
**Recommendation:** Convert to RSC
- Same pattern as above
- Server Component handles searchParams
- Client component handles interactivity

#### 3. **`/app/lists/maintenances/page.tsx`**
**Current:** `'use client'`, fetches via API
**Recommendation:** Convert to RSC
- Create `lib/data/maintenances.ts`
- Server Component fetches data
- Add `loading.tsx`

#### 4. **`/app/employees/page.tsx`**
**Current:** `'use client'`, fetches via `/api/employees`
**Recommendation:** Convert to RSC
- Create `lib/data/employees.ts`
- Server Component fetches data
- Add `loading.tsx`

#### 5. **`/app/forms/history/page.tsx`**
**Current:** `'use client'`, fetches via `/api/forms/history`
**Recommendation:** Convert to RSC
- Already has data fetching logic
- Convert to Server Component
- Add `loading.tsx`

---

## 🟢 LOW PRIORITY - React Query Optimization

### Already Using React Query Well ✅
- Dashboard Client - Uses initialData from RSC
- Activity Client - Uses initialData from RSC
- Assets Page - Uses React Query with proper staleTime
- Lists Pages - Uses React Query

### Could Improve:
1. **Shared Query Keys** - Some components use different keys for same data
2. **Prefetching** - Could prefetch data on hover/navigation
3. **Optimistic Updates** - Add for mutations (create/update/delete)

---

## 📊 Summary

### Redis Caching Needed: **9 API routes**
- `/api/assets/route.ts` ⚠️ CRITICAL
- `/api/assets/[id]/route.ts` ⚠️ CRITICAL
- `/api/employees/route.ts`
- `/api/forms/history/route.ts`
- 5 stats routes

### RSC Conversion Needed: **5 pages**
- `/app/assets/page.tsx`
- `/app/lists/assets/page.tsx`
- `/app/lists/maintenances/page.tsx`
- `/app/employees/page.tsx`
- `/app/forms/history/page.tsx`

### React Query: **Already Good** ✅
- Most pages use React Query correctly
- Layout-level data handled with `useUserProfile`
- Could add prefetching and optimistic updates

---

## 🎯 Recommended Implementation Order

1. **Phase 1:** Add Redis caching to `/api/assets/route.ts` (highest impact)
2. **Phase 2:** Add Redis caching to `/api/assets/[id]/route.ts`
3. **Phase 3:** Convert `/app/assets/page.tsx` to RSC
4. **Phase 4:** Add Redis caching to remaining API routes
5. **Phase 5:** Convert remaining pages to RSC

---

## 📝 Notes

- All cache invalidation already handled via `clearCache()` calls
- Redis TTLs should be:
  - **5-15 seconds** for frequently changing data (assets, activities)
  - **30 seconds** for moderately changing data (employees, forms)
  - **5-10 minutes** for rarely changing data (categories, locations)

