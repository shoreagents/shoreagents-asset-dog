import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { calculateNextRunAt } from '@/lib/report-schedule-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageReports')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const schedule = await prisma.automatedReportSchedule.findUnique({
      where: { id },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('Error fetching automated report schedule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch automated report schedule' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageReports')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
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
      isActive,
    } = body

    // Validate email format if emailRecipients is provided
    if (emailRecipients && Array.isArray(emailRecipients)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      for (const email of emailRecipients) {
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { error: `Invalid email address: ${email}` },
            { status: 400 }
          )
        }
      }
    }

    // Calculate next run time if schedule changed
    const updateData: any = {}
    if (reportName !== undefined) updateData.reportName = reportName
    if (reportType !== undefined) updateData.reportType = reportType
    if (frequency !== undefined) updateData.frequency = frequency
    if (frequencyDay !== undefined) updateData.frequencyDay = frequencyDay
    if (frequencyMonth !== undefined) updateData.frequencyMonth = frequencyMonth
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime
    if (emailRecipients !== undefined) updateData.emailRecipients = emailRecipients
    if (filters !== undefined) updateData.filters = filters
    if (format !== undefined) updateData.format = format
    if (includeList !== undefined) updateData.includeList = includeList
    if (isActive !== undefined) updateData.isActive = isActive

    // Recalculate next run time if schedule parameters changed
    if (frequency !== undefined || frequencyDay !== undefined || frequencyMonth !== undefined || scheduledTime !== undefined) {
      const currentSchedule = await prisma.automatedReportSchedule.findUnique({
        where: { id },
      })
      
      if (currentSchedule) {
        updateData.nextRunAt = calculateNextRunAt({
          frequency: frequency || currentSchedule.frequency,
          frequencyDay: frequencyDay !== undefined ? frequencyDay : currentSchedule.frequencyDay,
          frequencyMonth: frequencyMonth !== undefined ? frequencyMonth : currentSchedule.frequencyMonth,
          scheduledTime: scheduledTime || currentSchedule.scheduledTime || '02:00',
        })
      }
    }

    const schedule = await prisma.automatedReportSchedule.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('Error updating automated report schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update automated report schedule' },
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

  const permissionCheck = await requirePermission('canManageReports')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    await prisma.automatedReportSchedule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting automated report schedule:', error)
    return NextResponse.json(
      { error: 'Failed to delete automated report schedule' },
      { status: 500 }
    )
  }
}

