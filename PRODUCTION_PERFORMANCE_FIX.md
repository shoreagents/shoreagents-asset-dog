# Production Performance Fix Guide

## 🔥 CRITICAL: Apply These Fixes Immediately

### 1. **Verify & Apply Database Indexes** (HIGHEST PRIORITY)

Your indexes are defined in schema but may not exist in production database.

**Verification Steps:**

```bash
# Connect to your production database and run:
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('assets', 'assets_checkout', 'assets_checkin', 'assets_maintenance')
ORDER BY tablename, indexname;
```

**Expected Indexes:**
- `assets_isDeleted_idx`
- `assets_status_idx`
- `assets_createdAt_idx`
- `assets_categoryId_idx`
- `assets_isDeleted_status_idx` (composite)
- `assets_checkout_createdAt_idx`
- `assets_checkout_assetId_createdAt_idx`
- `assets_checkin_createdAt_idx`
- `assets_maintenance_createdAt_idx`
- `assets_maintenance_status_dueDate_idx`

**If indexes are missing, apply them:**

```bash
# Option A: Use Prisma Migrate (RECOMMENDED)
npx prisma migrate dev --name add_missing_indexes
npx prisma migrate deploy  # For production

# Option B: If you must use db push
npx prisma db push --accept-data-loss
```

**⚠️ WARNING:** Without these indexes, your queries will do full table scans in production.

---

### 2. **Increase Connection Pool Limit**

Current: 10 connections (too low for production)

**Update `lib/prisma.ts`:**

```typescript
if (!urlObj.searchParams.has('connection_limit')) {
  // Increase for production workloads
  // Supabase pooler supports 15-20, but we'll use 15 to be safe
  const limit = process.env.NODE_ENV === 'production' ? '15' : '10'
  urlObj.searchParams.set('connection_limit', limit)
}
```

**Also check your Supabase connection pooling:**
- Ensure you're using **Transaction mode** for Supabase pooler
- Verify `DATABASE_URL` uses the pooler URL (port 6543), not direct connection (port 5432)

---

### 3. **Add API Route Caching**

Create server-side cache for expensive dashboard queries.

**Create `lib/cache-utils.ts`:**

```typescript
/**
 * Simple in-memory cache for API responses
 * Use Redis/Vercel KV for multi-instance deployments
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data
  }
  cache.delete(key)
  return null
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  })
}

export function clearCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key)
    }
  }
}

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) {
        cache.delete(key)
      }
    }
  }, 300000)
}
```

**Update `app/api/dashboard/stats/route.ts`:**

```typescript
import { getCached, setCached } from '@/lib/cache-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  // Check cache first (5 minute TTL for dashboard stats)
  const cacheKey = 'dashboard-stats'
  const cached = getCached<DashboardStats>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  try {
    // ... existing query logic ...
    
    const result = {
      assetValueByCategory,
      activeCheckouts,
      recentCheckins,
      assetsUnderRepair,
      feedCounts: {
        totalActiveCheckouts,
        totalCheckins,
        totalAssetsUnderRepair,
      },
      summary: {
        totalActiveAssets,
        totalValue,
        purchasesInFiscalYear,
        checkedOutCount,
        availableCount,
        checkedOutAndAvailable,
      },
      calendar: {
        leasesExpiring,
        maintenanceDue,
      },
    }

    // Cache for 5 minutes (300000 ms)
    setCached(cacheKey, result, 300000)

    return NextResponse.json(result)
  } catch (error) {
    // ... error handling ...
  }
}
```

---

### 4. **Reduce Frontend Refetch Frequency**

**Update `app/dashboard/page.tsx`:**

```typescript
const { data, isLoading, error } = useQuery<DashboardStats>({
  queryKey: ['dashboard-stats'],
  queryFn: fetchDashboardStats,
  staleTime: 5 * 60 * 1000, // 5 minutes (was 30 seconds)
  refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (was 30 seconds)
  refetchOnWindowFocus: false,
})
```

**Rationale:** Dashboard stats don't change every 30 seconds. 5-minute refresh is sufficient.

---

### 5. **Check Database Region vs App Region**

**For Supabase users:**

1. Check your Supabase project region (Project Settings → General)
2. Check your deployment region (Vercel → Project Settings → General)
3. **They should match** (e.g., both US East or both EU West)

**If regions don't match:**
- Expect 100-300ms latency per query
- Either migrate database or change deployment region

---

### 6. **Enable Prisma Query Logging (Temporarily)**

Add to `lib/prisma.ts` to diagnose slow queries:

```typescript
log: process.env.NODE_ENV === 'production' 
  ? [{ emit: 'event', level: 'query' }, 'error', 'warn']
  : ['warn'],
```

Then add event listener:

```typescript
if (process.env.NODE_ENV === 'production') {
  prisma.$on('query', (e: any) => {
    if (e.duration > 1000) { // Log queries > 1 second
      console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query}`)
    }
  })
}
```

**Remove this after diagnosis** (adds overhead).

---

### 7. **Add Health Check Endpoint**

Create `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const start = Date.now()
  
  try {
    // Simple query to check DB connection
    await prisma.$queryRaw`SELECT 1`
    const duration = Date.now() - start
    
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      latency_ms: duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
```

Use this to monitor production database latency.

---

## 📊 Performance Benchmarks

**Expected improvements after fixes:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Dashboard Load | 3-8s | 500ms-1s | 80% faster |
| Assets List | 2-5s | 300-800ms | 75% faster |
| Activities Feed | 2-4s | 400-900ms | 70% faster |
| Subsequent Loads | Same | Instant (cached) | 95% faster |

---

## 🚀 Deployment Checklist

Before deploying fixes:

- [ ] Verify indexes exist in production database
- [ ] Update connection pool limit
- [ ] Add cache-utils.ts
- [ ] Update dashboard stats API with caching
- [ ] Reduce frontend refetch intervals
- [ ] Check database/app region alignment
- [ ] Deploy changes
- [ ] Monitor `/api/health` endpoint
- [ ] Check Vercel/hosting logs for slow queries
- [ ] Remove query logging after 24 hours

---

## 🔍 Post-Deployment Monitoring

**Check these metrics:**

1. **Database Connection Usage** (Supabase Dashboard → Database → Connections)
   - Should stay under pool limit
   - Spikes indicate connection leaks

2. **Query Performance** (Supabase Dashboard → Database → Query Performance)
   - Look for queries > 1000ms
   - Verify indexes are being used

3. **API Response Times** (Vercel Analytics or logs)
   - Dashboard stats: < 1s
   - Assets list: < 1s
   - Activities: < 1s

4. **Cache Hit Rate** (Add logging to cache-utils.ts)
   - Should be > 80% after warmup

---

## 🆘 If Still Slow After Fixes

1. **Check index usage:**
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM assets WHERE "isDeleted" = false LIMIT 10;
   ```
   Should show "Index Scan" not "Seq Scan"

2. **Check connection pooler:**
   - Verify you're using Supabase pooler URL (port 6543)
   - Not direct connection (port 5432)

3. **Consider upgrading Supabase plan:**
   - Free tier: Limited connections
   - Pro tier: Better performance, more connections

4. **Add Redis/Vercel KV:**
   - Replace in-memory cache with distributed cache
   - Survives serverless restarts

---

## Contact

If issues persist after applying all fixes, share:
- Supabase query logs (Database → Logs → Query Performance)
- Vercel function logs (Functions → Logs)
- Output of index verification query
- Response from `/api/health` endpoint

