import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { retryDbOperation } from "@/lib/db-utils"
import { requirePermission } from "@/lib/permission-utils"

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission("canViewReturnForms")
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

    const returnForms = await retryDbOperation(() =>
      prisma.returnForm.findMany({
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
          dateReturned: "desc",
        },
      })
    )

    return NextResponse.json({ returnForms }, { status: 200 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === "P1001" || prismaError?.code === "P2024") {
      return NextResponse.json(
        { error: "Database connection limit reached. Please try again in a moment." },
        { status: 503 }
      )
    }
    console.error("Error fetching return forms:", error)
    return NextResponse.json(
      { error: "Failed to fetch return forms" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission("canManageReturnForms")
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()

    const returnForm = await retryDbOperation(() =>
      prisma.returnForm.create({
        data: {
          employeeUserId: body.employeeUserId,
          dateReturned: new Date(body.dateReturned),
          department: body.department || null,
          ctrlNo: body.ctrlNo || null,
          returnType: body.returnType || "Return to Office",
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

    return NextResponse.json({ returnForm }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === "P1001" || prismaError?.code === "P2024") {
      return NextResponse.json(
        { error: "Database connection limit reached. Please try again in a moment." },
        { status: 503 }
      )
    }
    console.error("Error creating return form:", error)
    return NextResponse.json(
      { error: "Failed to create return form" },
      { status: 500 }
    )
  }
}

