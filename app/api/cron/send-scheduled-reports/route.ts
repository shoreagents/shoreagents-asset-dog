import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateNextRunAt } from '@/lib/report-schedule-utils'
import { sendAutomatedReportEmail } from '@/lib/report-email'

/**
 * Cron job endpoint for sending scheduled automated reports
 * 
 * NOTE: Vercel Hobby plan only supports one cron job per day.
 * For more frequent execution (hourly, every 6 hours, etc.), use an external cron service:
 * - cron-job.org
 * - EasyCron
 * - GitHub Actions
 * - Or upgrade to Vercel Pro plan
 * 
 * To use external cron service:
 * 1. Set CRON_SECRET environment variable
 * 2. Configure external service to call: GET https://your-domain.vercel.app/api/cron/send-scheduled-reports
 * 3. Add header: Authorization: Bearer {CRON_SECRET}
 * 4. Set frequency as needed (hourly, every 6 hours, etc.)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (for security)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const now = new Date()
    
    // Find all active schedules that are due to run
    const dueSchedules = await prisma.automatedReportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now,
        },
      },
    })

    if (dueSchedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled reports due',
        processedCount: 0,
      })
    }

    const results = []
    
    for (const schedule of dueSchedules) {
      try {
        // Generate the report based on report type
        const reportData = await generateReport(schedule.reportType, schedule.filters || {})
        
        // Convert report to requested format
        let attachment: { filename: string; content: Buffer | string } | undefined
        
        if (schedule.format === 'pdf') {
          attachment = await generatePDFAttachment(reportData, schedule)
        } else if (schedule.format === 'csv') {
          attachment = await generateCSVAttachment(reportData, schedule)
        } else if (schedule.format === 'excel') {
          attachment = await generateExcelAttachment(reportData, schedule)
        }

        // Send email with attachment
        const emailResult = await sendAutomatedReportEmail({
          to: schedule.emailRecipients,
          reportName: schedule.reportName,
          reportType: schedule.reportType,
          format: schedule.format,
          attachment,
        })

        if (emailResult.success) {
          // Calculate next run time
          const nextRunAt = calculateNextRunAt({
            frequency: schedule.frequency,
            frequencyDay: schedule.frequencyDay,
            frequencyMonth: schedule.frequencyMonth,
            scheduledTime: schedule.scheduledTime,
          })

          // Update schedule with last sent time and next run time
          await prisma.automatedReportSchedule.update({
            where: { id: schedule.id },
            data: {
              lastSentAt: now,
              nextRunAt,
            },
          })

          results.push({
            scheduleId: schedule.id,
            reportName: schedule.reportName,
            status: 'success',
            recipients: schedule.emailRecipients.length,
          })
        } else {
          results.push({
            scheduleId: schedule.id,
            reportName: schedule.reportName,
            status: 'failed',
            error: emailResult.error,
          })
        }
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error)
        results.push({
          scheduleId: schedule.id,
          reportName: schedule.reportName,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${dueSchedules.length} scheduled report(s)`,
      processedCount: dueSchedules.length,
      results,
    })
  } catch (error) {
    console.error('Error processing scheduled reports:', error)
    return NextResponse.json(
      { error: 'Failed to process scheduled reports' },
      { status: 500 }
    )
  }
}

/**
 * Generate report data based on report type and filters
 */
async function generateReport(reportType: string, filters: any): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const apiUrl = `${baseUrl}/api/reports/${reportType}`
  
  // Build query string from filters
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.append(key, String(value))
      }
    })
  }
  
  const url = params.toString() ? `${apiUrl}?${params.toString()}` : apiUrl
  
  // Fetch report data (using internal fetch)
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch report data: ${response.statusText}`)
  }
  
  return await response.json()
}

/**
 * Generate PDF attachment
 */
async function generatePDFAttachment(reportData: any, schedule: any): Promise<{ filename: string; content: Buffer | string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const exportUrl = `${baseUrl}/api/reports/${schedule.reportType}/export`
  
  const response = await fetch(exportUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format: 'pdf',
      filters: schedule.filters || {},
      includeList: schedule.includeList,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to generate PDF: ${response.statusText}`)
  }
  
  const pdfBuffer = await response.arrayBuffer()
  const filename = `${schedule.reportName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  
  return {
    filename,
    content: Buffer.from(pdfBuffer),
  }
}

/**
 * Generate CSV attachment
 */
async function generateCSVAttachment(reportData: any, schedule: any): Promise<{ filename: string; content: Buffer | string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const exportUrl = `${baseUrl}/api/reports/${schedule.reportType}/export`
  
  const response = await fetch(exportUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format: 'csv',
      filters: schedule.filters || {},
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to generate CSV: ${response.statusText}`)
  }
  
  const csvText = await response.text()
  const filename = `${schedule.reportName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  
  return {
    filename,
    content: csvText,
  }
}

/**
 * Generate Excel attachment
 */
async function generateExcelAttachment(reportData: any, schedule: any): Promise<{ filename: string; content: Buffer | string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const exportUrl = `${baseUrl}/api/reports/${schedule.reportType}/export`
  
  const response = await fetch(exportUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format: 'excel',
      filters: schedule.filters || {},
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to generate Excel: ${response.statusText}`)
  }
  
  const excelBuffer = await response.arrayBuffer()
  const filename = `${schedule.reportName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
  
  return {
    filename,
    content: Buffer.from(excelBuffer),
  }
}

