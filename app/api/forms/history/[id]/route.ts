import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { retryDbOperation } from "@/lib/db-utils"
import { requirePermission } from "@/lib/permission-utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const formType = searchParams.get("type") || "accountability" // "accountability" or "return"

    // Check permissions based on form type
    if (formType === "return") {
      const permissionCheck = await requirePermission("canViewReturnForms")
      if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }
    } else {
      const permissionCheck = await requirePermission("canViewAccountabilityForms")
      if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }
    }

    if (formType === "return") {
      const returnForm = await retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).returnForm.findUnique({
          where: { id: resolvedParams.id },
          include: {
            employeeUser: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true,
              },
            },
          },
        })
      )

      if (!returnForm) {
        return NextResponse.json(
          { error: "Return form not found" },
          { status: 404 }
        )
      }

      // Parse form data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedFormData = (returnForm as any).formData ? JSON.parse((returnForm as any).formData) : null

      // Fetch asset details if formData has selectedAssets
      if (parsedFormData?.selectedAssets && Array.isArray(parsedFormData.selectedAssets)) {
        const assetIds = parsedFormData.selectedAssets.map((asset: { id: string }) => asset.id)
        if (assetIds.length > 0) {
          const assets = await retryDbOperation(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prisma as any).assets.findMany({
              where: {
                id: { in: assetIds },
                isDeleted: false,
              },
              select: {
                id: true,
                assetTagId: true,
                description: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                subCategory: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            })
          )

          // Merge asset details with form data
          parsedFormData.selectedAssets = parsedFormData.selectedAssets.map((formAsset: { id: string; assetTagId: string; description: string; quantity?: number; condition?: boolean; remarks?: string }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assetDetail = (assets as any[]).find((a: { id: string }) => a.id === formAsset.id)
            return {
              ...formAsset,
              category: assetDetail?.category || null,
              subCategory: assetDetail?.subCategory || null,
            }
          })
        }
      }

      return NextResponse.json(
        {
          returnForm: {
            ...returnForm,
            formData: parsedFormData,
          },
        },
        { status: 200 }
      )
    } else {
      const accountabilityForm = await retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).accountabilityForm.findUnique({
          where: { id: resolvedParams.id },
          include: {
            employeeUser: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true,
              },
            },
          },
        })
      )

      if (!accountabilityForm) {
        return NextResponse.json(
          { error: "Accountability form not found" },
          { status: 404 }
        )
      }

      // Parse form data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedFormData = (accountabilityForm as any).formData ? JSON.parse((accountabilityForm as any).formData) : null

      // Fetch asset details if formData has selectedAssets
      if (parsedFormData?.selectedAssets && Array.isArray(parsedFormData.selectedAssets)) {
        const assetIds = parsedFormData.selectedAssets.map((asset: { id: string }) => asset.id)
        if (assetIds.length > 0) {
          const assets = await retryDbOperation(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prisma as any).assets.findMany({
              where: {
                id: { in: assetIds },
                isDeleted: false,
              },
              select: {
                id: true,
                assetTagId: true,
                description: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                subCategory: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            })
          )

          // Merge asset details with form data
          parsedFormData.selectedAssets = parsedFormData.selectedAssets.map((formAsset: { id: string; assetTagId: string; description: string; remarks?: string }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assetDetail = (assets as any[]).find((a: { id: string }) => a.id === formAsset.id)
            return {
              ...formAsset,
              category: assetDetail?.category || null,
              subCategory: assetDetail?.subCategory || null,
            }
          })
        }
      }

      return NextResponse.json(
        {
          accountabilityForm: {
            ...accountabilityForm,
            formData: parsedFormData,
          },
        },
        { status: 200 }
      )
    }
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === "P1001" || prismaError?.code === "P2024") {
      return NextResponse.json(
        { error: "Database connection limit reached. Please try again in a moment." },
        { status: 503 }
      )
    }
    console.error("Error fetching form:", error)
    return NextResponse.json(
      { error: "Failed to fetch form" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const resolvedParams = await params
    const { searchParams } = new URL(request.url)
    const formType = searchParams.get("type") || "accountability" // "accountability" or "return"

    // Check permissions based on form type
    if (formType === "return") {
      const permissionCheck = await requirePermission("canManageReturnForms")
      if (!permissionCheck.allowed && permissionCheck.error) {
        return permissionCheck.error
      }
    } else {
      const permissionCheck = await requirePermission("canManageAccountabilityForms")
      if (!permissionCheck.allowed && permissionCheck.error) {
        return permissionCheck.error
      }
    }

    if (formType === "return") {
      // Check if form exists
      const returnForm = await retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).returnForm.findUnique({
          where: { id: resolvedParams.id },
        })
      )

      if (!returnForm) {
        return NextResponse.json(
          { error: "Return form not found" },
          { status: 404 }
        )
      }

      // Delete the form
      await retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).returnForm.delete({
          where: { id: resolvedParams.id },
        })
      )

      return NextResponse.json({ message: "Return form deleted successfully" })
    } else {
      // Check if form exists
      const accountabilityForm = await retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).accountabilityForm.findUnique({
          where: { id: resolvedParams.id },
        })
      )

      if (!accountabilityForm) {
        return NextResponse.json(
          { error: "Accountability form not found" },
          { status: 404 }
        )
      }

      // Delete the form
      await retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).accountabilityForm.delete({
          where: { id: resolvedParams.id },
        })
      )

      return NextResponse.json({ message: "Accountability form deleted successfully" })
    }
  } catch (error) {
    console.error("Error deleting form:", error)
    return NextResponse.json(
      { error: "Failed to delete form" },
      { status: 500 }
    )
  }
}
