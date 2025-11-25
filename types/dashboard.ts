export type DashboardStats = {
  assetValueByCategory: Array<{ name: string; value: number }>
  activeCheckouts: Array<{
    id: string
    checkoutDate: string
    expectedReturnDate: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    employeeUser: {
      id: string
      name: string
      email: string
    } | null
  }>
  recentCheckins: Array<{
    id: string
    checkinDate: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    checkout: {
      employeeUser: {
        id: string
        name: string
        email: string
      }
    }
  }>
  assetsUnderRepair: Array<{
    id: string
    dueDate: string | null
    status: string
    maintenanceBy: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }>
  feedCounts: {
    totalActiveCheckouts: number
    totalCheckins: number
    totalAssetsUnderRepair: number
  }
  summary: {
    totalActiveAssets: number
    totalValue: number
    purchasesInFiscalYear: number
    checkedOutCount: number
    availableCount: number
    checkedOutAndAvailable: number
  }
  calendar: {
    leasesExpiring: Array<{
      id: string
      leaseEndDate: string | null
      lessee: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
    maintenanceDue: Array<{
      id: string
      dueDate: string | null
      title: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
  }
}

