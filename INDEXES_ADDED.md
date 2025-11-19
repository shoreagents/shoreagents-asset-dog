# Database Indexes Added for Performance Optimization

## Summary
Added comprehensive indexes to improve query performance, especially in production environments with large datasets.

## Indexes Added

### Assets Model
- `@@index([isDeleted])` - Used in almost every query to filter deleted assets
- `@@index([status])` - Used for filtering by status
- `@@index([createdAt])` - Used for sorting by creation date
- `@@index([categoryId])` - Used for joins with categories
- `@@index([isDeleted, status])` - Composite index for common filter combination

### AssetsCheckout Model
- `@@index([createdAt])` - Used for sorting activities by creation date
- `@@index([assetId, createdAt])` - Composite index for asset-specific queries with sorting

### AssetsCheckin Model
- `@@index([createdAt])` - Used for sorting activities by creation date

### AssetsMove Model
- `@@index([createdAt])` - Used for sorting activities by creation date

### AssetsReserve Model
- `@@index([createdAt])` - Used for sorting activities by creation date

### AssetsLease Model
- `@@index([createdAt])` - Used for sorting activities by creation date
- `@@index([leaseEndDate, createdAt])` - Composite index for calendar queries filtering by end date and sorting

### AssetsLeaseReturn Model
- `@@index([createdAt])` - Used for sorting activities by creation date

### AssetsDispose Model
- `@@index([createdAt])` - Used for sorting activities by creation date

### AssetsMaintenance Model
- `@@index([createdAt])` - Used for sorting activities by creation date
- `@@index([status, dueDate])` - Composite index for dashboard calendar queries filtering by status and due date

### AssetsAuditHistory Model
- `@@index([createdAt])` - Used for sorting audit history

### EmployeeUser Model
- `@@index([name])` - Used for searching employees by name
- `@@index([email])` - Used for searching employees by email (already unique, but index helps with LIKE queries)
- `@@index([department])` - Used for filtering/searching by department

### AssetUser Model
- `@@index([isActive])` - Used for filtering active users
- `@@index([isActive, isApproved])` - Composite index for common user filtering

## Performance Impact

### Expected Improvements:
1. **Activities API**: 2-5x faster with `createdAt` indexes on all activity models
2. **Dashboard Stats**: Already optimized with SQL aggregation + indexes
3. **Employee Search**: 3-10x faster with name/email/department indexes
4. **Assets Filtering**: 2-5x faster with composite indexes on common filter combinations
5. **User Queries**: Faster filtering of active/approved users

### Query Patterns Optimized:
- Sorting by `createdAt` (most common sort in activities)
- Filtering by `isDeleted` and `status` (most common filters)
- Searching employees by name/email/department
- Dashboard calendar queries filtering by status and dates
- User management queries filtering by active/approved status

## Migration Steps

1. **Development:**
   ```bash
   npx prisma migrate dev --name add_performance_indexes
   ```

2. **Production:**
   ```bash
   npx prisma migrate deploy
   ```

## Notes

- Indexes slightly increase write time but dramatically improve read performance
- Composite indexes are most effective when queries match the index column order
- Monitor query performance after deployment to verify improvements
- Consider adding more indexes based on production query patterns

