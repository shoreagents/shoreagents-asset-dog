import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { retryDbOperation } from "@/lib/db-utils"
import { requirePermission } from "@/lib/permission-utils"

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const formType = searchParams.get("formType") || "accountability" // "accountability" or "return"

    // Check permissions based on form type
    if (formType === "return") {
      const permissionCheck = await requirePermission("canViewReturnForms")
      if (!permissionCheck.allowed) return permissionCheck.error
    } else {
      const permissionCheck = await requirePermission("canViewAccountabilityForms")
      if (!permissionCheck.allowed) return permissionCheck.error
    }
    const search = searchParams.get("search")
    const searchType = searchParams.get("searchType") || "unified" // "unified", "employee", "department", "formNo"
    const page = parseInt(searchParams.get("page") || "1", 10)
    const pageSize = parseInt(searchParams.get("pageSize") || "100", 10)
    const skip = (page - 1) * pageSize

    // Build where clauses for both form types (for counts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const returnWhere: any = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountabilityWhere: any = {}

    if (search) {
      const searchLower = search.toLowerCase()
      if (searchType === "unified") {
        returnWhere.OR = [
          { employeeUser: { name: { contains: searchLower, mode: "insensitive" } } },
          { employeeUser: { email: { contains: searchLower, mode: "insensitive" } } },
          { department: { contains: searchLower, mode: "insensitive" } },
          { ctrlNo: { contains: searchLower, mode: "insensitive" } },
        ]
        accountabilityWhere.OR = [
          { employeeUser: { name: { contains: searchLower, mode: "insensitive" } } },
          { employeeUser: { email: { contains: searchLower, mode: "insensitive" } } },
          { department: { contains: searchLower, mode: "insensitive" } },
          { accountabilityFormNo: { contains: searchLower, mode: "insensitive" } },
        ]
      } else if (searchType === "employee") {
        returnWhere.OR = [
          { employeeUser: { name: { contains: searchLower, mode: "insensitive" } } },
          { employeeUser: { email: { contains: searchLower, mode: "insensitive" } } },
        ]
        accountabilityWhere.OR = [
          { employeeUser: { name: { contains: searchLower, mode: "insensitive" } } },
          { employeeUser: { email: { contains: searchLower, mode: "insensitive" } } },
        ]
      } else if (searchType === "department") {
        returnWhere.department = { contains: searchLower, mode: "insensitive" }
        accountabilityWhere.department = { contains: searchLower, mode: "insensitive" }
      } else if (searchType === "formNo") {
        returnWhere.ctrlNo = { contains: searchLower, mode: "insensitive" }
        accountabilityWhere.accountabilityFormNo = { contains: searchLower, mode: "insensitive" }
      }
    }

    // Always fetch counts for both tabs
    const [returnFormsCount, accountabilityFormsCount] = await Promise.all([
      retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).returnForm.count({ where: returnWhere })
      ),
      retryDbOperation(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as any).accountabilityForm.count({ where: accountabilityWhere })
      ),
    ])

    if (formType === "return") {
      // Return Forms
      const [returnForms, total] = await Promise.all([
        retryDbOperation(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (prisma as any).returnForm.findMany({
            where: returnWhere,
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
            skip,
            take: pageSize,
          })
        ),
        Promise.resolve(returnFormsCount),
      ])

      const totalPages = Math.ceil((total as number) / pageSize)

      return NextResponse.json(
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          returnForms: (returnForms as any[]).map((form: { formData?: string; [key: string]: unknown }) => ({
            ...form,
            formData: form.formData ? JSON.parse(form.formData) : null,
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
          counts: {
            returnForms: returnFormsCount,
            accountabilityForms: accountabilityFormsCount,
          },
        },
        { status: 200 }
      )
    } else {
      // Accountability Forms
      const [accountabilityForms, total] = await Promise.all([
        retryDbOperation(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (prisma as any).accountabilityForm.findMany({
            where: accountabilityWhere,
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
            skip,
            take: pageSize,
          })
        ),
        Promise.resolve(accountabilityFormsCount),
      ])

      const totalPages = Math.ceil((total as number) / pageSize)

      return NextResponse.json(
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          accountabilityForms: (accountabilityForms as any[]).map((form: { formData?: string; [key: string]: unknown }) => ({
            ...form,
            formData: form.formData ? JSON.parse(form.formData) : null,
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
          counts: {
            returnForms: returnFormsCount,
            accountabilityForms: accountabilityFormsCount,
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
    console.error("Error fetching form history:", error)
    return NextResponse.json(
      { error: "Failed to fetch form history" },
      { status: 500 }
    )
  }
}

