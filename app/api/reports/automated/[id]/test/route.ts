import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { sendAutomatedReportEmail } from '@/lib/report-email'

export async function POST(
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

    // Generate the report
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    // Build query parameters from filters
    const queryParams = new URLSearchParams()
    queryParams.set('format', schedule.format)
    
    if (schedule.includeList !== undefined) {
      if (schedule.reportType === 'assets') {
        queryParams.set('includeAssetList', schedule.includeList.toString())
      } else if (schedule.reportType === 'transaction') {
        queryParams.set('includeTransactionList', schedule.includeList.toString())
      }
    }
    
    // Add filters to query params
    if (schedule.filters && typeof schedule.filters === 'object') {
      Object.entries(schedule.filters as Record<string, unknown>).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          queryParams.set(key, String(value))
        }
      })
    }
    
    const exportUrl = `${baseUrl}/api/reports/${schedule.reportType}/export?${queryParams.toString()}`
    
    let attachment: { filename: string; content: Buffer | string } | undefined
    
    try {
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`)
      }
      
      if (schedule.format === 'pdf') {
        const pdfBuffer = await response.arrayBuffer()
        attachment = {
          filename: `TEST_${schedule.reportName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: Buffer.from(pdfBuffer),
        }
      } else if (schedule.format === 'csv') {
        const csvText = await response.text()
        attachment = {
          filename: `TEST_${schedule.reportName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`,
          content: csvText,
        }
      } else if (schedule.format === 'excel') {
        const excelBuffer = await response.arrayBuffer()
        attachment = {
          filename: `TEST_${schedule.reportName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
          content: Buffer.from(excelBuffer),
        }
      }
    } catch (error) {
      console.error('Error generating test report:', error)
      return NextResponse.json(
        { error: 'Failed to generate test report. Please check if the report API is accessible.' },
        { status: 500 }
      )
    }

    // Send test email
    const emailResult = await sendAutomatedReportEmail({
      to: schedule.emailRecipients,
      reportName: `[TEST] ${schedule.reportName}`,
      reportType: schedule.reportType,
      format: schedule.format,
      attachment,
    })

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send test email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
    })
  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}

