import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Helper function to format numbers with commas
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return ''
    }
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'excel'
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock') === 'true'
    
    // Summary fields to include
    const includeSummary = searchParams.get('includeSummary') === 'true'
    const includeByCategory = searchParams.get('includeByCategory') === 'true'
    const includeByStatus = searchParams.get('includeByStatus') === 'true'
    const includeTotalCost = searchParams.get('includeTotalCost') === 'true'
    const includeLowStock = searchParams.get('includeLowStock') === 'true'
    const includeItemList = searchParams.get('includeItemList') === 'true'
    
    // Item fields to include (comma-separated)
    const itemFields = searchParams.get('itemFields')?.split(',') || []

    // Build where clause
    const whereClause: Prisma.InventoryItemWhereInput = {
      isDeleted: false,
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Category filter
    if (category) {
      whereClause.category = category
    }

    // Fetch all items (for export, we want all matching items)
    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    })

    // Filter low stock items if requested
    let filteredItems = items
    if (lowStock) {
      filteredItems = items.filter(item => {
        const stock = parseFloat(item.currentStock.toString())
        const minLevel = item.minStockLevel ? parseFloat(item.minStockLevel.toString()) : null
        return minLevel !== null && stock <= minLevel
      })
    }

    // Calculate summary data
    const totalItems = filteredItems.length
    const totalStock = filteredItems.reduce((sum, item) => sum + parseFloat(item.currentStock.toString()), 0)
    const totalCost = filteredItems.reduce((sum, item) => {
      const stock = parseFloat(item.currentStock.toString())
      const cost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0
      return sum + (stock * cost)
    }, 0)

    // Group by category
    const byCategory = new Map<string, { count: number; totalStock: number; totalCost: number }>()
    filteredItems.forEach(item => {
      const category = item.category || 'Uncategorized'
      if (!byCategory.has(category)) {
        byCategory.set(category, { count: 0, totalStock: 0, totalCost: 0 })
      }
      const group = byCategory.get(category)!
      group.count++
      group.totalStock += parseFloat(item.currentStock.toString())
      const cost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0
      group.totalCost += parseFloat(item.currentStock.toString()) * cost
    })

    // Group by status
    const byStatus = new Map<string, { count: number; totalStock: number; totalCost: number }>()
    filteredItems.forEach(item => {
      const stock = parseFloat(item.currentStock.toString())
      const minLevel = item.minStockLevel ? parseFloat(item.minStockLevel.toString()) : null
      let status = 'In Stock'
      if (stock === 0) {
        status = 'Out of Stock'
      } else if (minLevel !== null && stock <= minLevel) {
        status = 'Low Stock'
      }
      
      if (!byStatus.has(status)) {
        byStatus.set(status, { count: 0, totalStock: 0, totalCost: 0 })
      }
      const group = byStatus.get(status)!
      group.count++
      group.totalStock += stock
      const cost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0
      group.totalCost += stock * cost
    })

    // Low stock items
    const lowStockItems = filteredItems.filter(item => {
      const stock = parseFloat(item.currentStock.toString())
      const minLevel = item.minStockLevel ? parseFloat(item.minStockLevel.toString()) : null
      return minLevel !== null && stock <= minLevel
    })

    // Generate Excel workbook
    const workbook = XLSX.utils.book_new()

    // Create Summary sheet
    if (includeSummary) {
      const summarySheetData = [
        { 'Metric': 'Total Items', 'Value': totalItems },
        { 'Metric': 'Total Stock', 'Value': Math.floor(totalStock) },
        { 'Metric': 'Total Cost', 'Value': formatNumber(totalCost) },
      ]
      const summarySheet = XLSX.utils.json_to_sheet(summarySheetData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
    }

    // Create By Category sheet
    if (includeByCategory && byCategory.size > 0) {
      const categorySheetData = Array.from(byCategory.entries()).map(([category, data]) => ({
        'Category': category,
        'Item Count': data.count,
        'Total Stock': Math.floor(data.totalStock),
        'Total Cost': formatNumber(data.totalCost),
      }))
      const categorySheet = XLSX.utils.json_to_sheet(categorySheetData)
      XLSX.utils.book_append_sheet(workbook, categorySheet, 'By Category')
    }

    // Create By Status sheet
    if (includeByStatus && byStatus.size > 0) {
      const statusSheetData = Array.from(byStatus.entries()).map(([status, data]) => ({
        'Status': status,
        'Item Count': data.count,
        'Total Stock': Math.floor(data.totalStock),
        'Total Cost': formatNumber(data.totalCost),
      }))
      const statusSheet = XLSX.utils.json_to_sheet(statusSheetData)
      XLSX.utils.book_append_sheet(workbook, statusSheet, 'By Status')
    }

    // Create Total Cost sheet
    if (includeTotalCost) {
      const totalCostSheetData = [
        { 'Description': 'Total Inventory Value', 'Amount': formatNumber(totalCost) },
      ]
      const totalCostSheet = XLSX.utils.json_to_sheet(totalCostSheetData)
      XLSX.utils.book_append_sheet(workbook, totalCostSheet, 'Total Cost')
    }

    // Create Low Stock Items sheet
    if (includeLowStock && lowStockItems.length > 0) {
      const lowStockSheetData = lowStockItems.map(item => ({
        'Item Code': item.itemCode,
        'Name': item.name,
        'Current Stock': Math.floor(parseFloat(item.currentStock.toString())),
        'Min Level': item.minStockLevel ? Math.floor(parseFloat(item.minStockLevel.toString())) : '',
      }))
      const lowStockSheet = XLSX.utils.json_to_sheet(lowStockSheetData)
      XLSX.utils.book_append_sheet(workbook, lowStockSheet, 'Low Stock Items')
    }

    // Create Item List sheet
    if (includeItemList && itemFields.length > 0) {
      const fieldLabels: Record<string, string> = {
        itemCode: 'Item Code',
        name: 'Name',
        description: 'Description',
        category: 'Category',
        unit: 'Unit',
        currentStock: 'Current Stock',
        minStockLevel: 'Min Stock Level',
        maxStockLevel: 'Max Stock Level',
        unitCost: 'Unit Cost',
        location: 'Location',
        supplier: 'Supplier',
        brand: 'Brand',
        model: 'Model',
        sku: 'SKU',
        barcode: 'Barcode',
        remarks: 'Remarks',
      }

      const itemSheetData = filteredItems.map(item => {
        const row: Record<string, any> = {}
        
        itemFields.forEach(fieldKey => {
          switch (fieldKey) {
            case 'itemCode':
              row[fieldLabels[fieldKey]] = item.itemCode
              break
            case 'name':
              row[fieldLabels[fieldKey]] = item.name
              break
            case 'description':
              row[fieldLabels[fieldKey]] = item.description || ''
              break
            case 'category':
              row[fieldLabels[fieldKey]] = item.category || ''
              break
            case 'unit':
              row[fieldLabels[fieldKey]] = item.unit || ''
              break
            case 'currentStock':
              row[fieldLabels[fieldKey]] = Math.floor(parseFloat(item.currentStock.toString()))
              break
            case 'minStockLevel':
              row[fieldLabels[fieldKey]] = item.minStockLevel ? Math.floor(parseFloat(item.minStockLevel.toString())) : ''
              break
            case 'maxStockLevel':
              row[fieldLabels[fieldKey]] = item.maxStockLevel ? Math.floor(parseFloat(item.maxStockLevel.toString())) : ''
              break
            case 'unitCost':
              row[fieldLabels[fieldKey]] = item.unitCost ? formatNumber(parseFloat(item.unitCost.toString())) : ''
              break
            case 'location':
              row[fieldLabels[fieldKey]] = item.location || ''
              break
            case 'supplier':
              row[fieldLabels[fieldKey]] = item.supplier || ''
              break
            case 'brand':
              row[fieldLabels[fieldKey]] = item.brand || ''
              break
            case 'model':
              row[fieldLabels[fieldKey]] = item.model || ''
              break
            case 'sku':
              row[fieldLabels[fieldKey]] = item.sku || ''
              break
            case 'barcode':
              row[fieldLabels[fieldKey]] = item.barcode || ''
              break
            case 'remarks':
              row[fieldLabels[fieldKey]] = item.remarks || ''
              break
          }
        })
        
        return row
      })

      const itemSheet = XLSX.utils.json_to_sheet(itemSheetData)
      XLSX.utils.book_append_sheet(workbook, itemSheet, 'Item List')
    }

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const filename = `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting inventory:', error)
    return NextResponse.json(
      { error: 'Failed to export inventory' },
      { status: 500 }
    )
  }
}

