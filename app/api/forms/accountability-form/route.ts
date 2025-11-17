import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { retryDbOperation } from "@/lib/db-utils"
import { requirePermission } from "@/lib/permission-utils"

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission("canViewAccountabilityForms")
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")

    const where: {
      employeeUserId?: string
    } = {}

    if (employeeId) {
      where.employeeUserId = employeeId
    }

    const accountabilityForms = await retryDbOperation(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).accountabilityForm.findMany({
        where,
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
        orderBy: {
          dateIssued: "desc",
        },
      })
    )

    return NextResponse.json({ accountabilityForms }, { status: 200 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === "P1001" || prismaError?.code === "P2024") {
      return NextResponse.json(
        { error: "Database connection limit reached. Please try again in a moment." },
        { status: 503 }
      )
    }
    console.error("Error fetching accountability forms:", error)
    return NextResponse.json(
      { error: "Failed to fetch accountability forms" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission("canManageAccountabilityForms")
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()

    const accountabilityForm = await retryDbOperation(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).accountabilityForm.create({
        data: {
          employeeUserId: body.employeeUserId,
          dateIssued: new Date(body.dateIssued),
          department: body.department || null,
          accountabilityFormNo: body.accountabilityFormNo || null,
          formData: JSON.stringify(body.formData || {}),
        },
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

    return NextResponse.json({ accountabilityForm }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === "P1001" || prismaError?.code === "P2024") {
      return NextResponse.json(
        { error: "Database connection limit reached. Please try again in a moment." },
        { status: 503 }
      )
    }
    console.error("Error creating accountability form:", error)
    return NextResponse.json(
      { error: "Failed to create accountability form" },
      { status: 500 }
    )
  }
}

