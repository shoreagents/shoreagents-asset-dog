import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { calculateNextRunAt } from '@/lib/report-schedule-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageReports')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const schedules = await prisma.automatedReportSchedule.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ schedules })
  } catch (error) {
    console.error('Error fetching automated report schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch automated report schedules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageReports')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const {
      reportName,
      reportType,
      frequency,
      frequencyDay,
      frequencyMonth,
      scheduledTime,
      emailRecipients,
      filters,
      format,
      includeList,
    } = body

    // Validate required fields
    if (!reportName || !reportType || !frequency || !scheduledTime || !emailRecipients || !Array.isArray(emailRecipients) || emailRecipients.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of emailRecipients) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid email address: ${email}` },
          { status: 400 }
        )
      }
    }

    // Calculate next run time
    const nextRunAt = calculateNextRunAt({
      frequency,
      frequencyDay,
      frequencyMonth,
      scheduledTime,
    })

    const userName = auth.user.user_metadata?.name || 
                     auth.user.user_metadata?.full_name || 
                     auth.user.email?.split('@')[0] || 
                     auth.user.email || 
                     auth.user.id

    const schedule = await prisma.automatedReportSchedule.create({
      data: {
        reportName,
        reportType,
        frequency,
        frequencyDay: frequencyDay || null,
        frequencyMonth: frequencyMonth || null,
        scheduledTime,
        emailRecipients,
        filters: filters || {},
        format: format || 'pdf',
        includeList: includeList !== undefined ? includeList : true,
        isActive: true,
        nextRunAt,
        createdBy: userName,
      },
    })

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error) {
    console.error('Error creating automated report schedule:', error)
    return NextResponse.json(
      { error: 'Failed to create automated report schedule' },
      { status: 500 }
    )
  }
}

