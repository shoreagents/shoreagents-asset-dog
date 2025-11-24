import { NextRequest, NextResponse } from 'next/server'
import puppeteerCore from 'puppeteer-core'
import puppeteer from 'puppeteer'
import chromium from '@sparticuz/chromium'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { existsSync } from 'fs'
import { join } from 'path'

// Format utilities
const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return 'N/A'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return 'N/A'
  }
}

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 'N/A'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(value))
  } catch {
    return 'N/A'
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    console.log('[PDF] Starting PDF generation...')
    const { id } = await params
    console.log('[PDF] Asset ID:', id)
    // No need to parse request body - we fetch all data server-side

    // Fetch all asset data with retry for connection issues
    console.log('[PDF] Fetching asset data...')
    const asset = await retryDbOperation(() =>
      prisma.assets.findFirst({
        where: {
          id,
          isDeleted: false,
        },
        include: {
          category: true,
          subCategory: true,
          checkouts: {
            include: {
              employeeUser: true,
              checkins: {
                take: 1,
              },
            },
            orderBy: { checkoutDate: 'desc' },
            take: 10,
          },
          auditHistory: {
            orderBy: { auditDate: 'desc' },
          },
        },
      })
    )

    if (!asset) {
      console.error('[PDF] Asset not found:', id)
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    console.log('[PDF] Asset found:', asset.assetTagId)
    
    // Fetch related data using transaction to optimize connection pool usage
    // This batches all queries into a single transaction, using fewer connections
    // Wrap in retry for transient connection errors
    console.log('[PDF] Fetching related data...')
    const [images, documents, maintenances, reservations, historyLogs] = await retryDbOperation(() =>
      prisma.$transaction(
        async (tx) => {
          return await Promise.all([
            tx.assetsImage.findMany({
              where: { assetTagId: asset.assetTagId },
              orderBy: { createdAt: 'desc' },
            }),
            tx.assetsDocument.findMany({
              where: { assetTagId: asset.assetTagId },
              orderBy: { createdAt: 'desc' },
            }),
            tx.assetsMaintenance.findMany({
              where: { assetId: asset.id },
              orderBy: { createdAt: 'desc' },
            }),
            tx.assetsReserve.findMany({
              where: {
                assetId: asset.id,
                reservationDate: { gte: new Date() },
              },
              include: {
                employeeUser: true,
              },
              orderBy: { reservationDate: 'asc' },
            }),
            tx.assetsHistoryLogs.findMany({
              where: { assetId: asset.id },
              orderBy: { eventDate: 'desc' },
            }),
          ])
        },
        {
          timeout: 30000, // 30 second timeout
          isolationLevel: 'ReadCommitted', // Read-only transaction
        }
      )
    )

    // Find active checkout
    const activeCheckout = asset.checkouts?.find(
      (checkout) => (checkout.checkins?.length ?? 0) === 0
    )

    const assignedTo = activeCheckout?.employeeUser?.name || 'N/A'
    const issuedTo = asset.issuedTo || 'N/A'

    console.log('[PDF] Data fetched. Generating HTML...')
    
    // Generate HTML with tables
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              font-size: 10px;
              line-height: 1.4;
              color: #000;
              padding: 15mm;
            }
            h1 { font-size: 18px; margin-bottom: 10px; }
            h2 { font-size: 14px; margin-top: 15px; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px;
              text-align: left;
              font-size: 9px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .section { margin-bottom: 20px; page-break-inside: avoid; }
            img { max-width: 100px; max-height: 100px; object-fit: contain; }
          </style>
        </head>
        <body>
          <h1>Asset Details: ${asset.assetTagId}</h1>
          <p><strong>Description:</strong> ${asset.description || 'N/A'}</p>

          <!-- Basic Details Table -->
          <h2>Basic Details</h2>
          <table>
            <tr><th style="width: 30%;">Field</th><th>Value</th></tr>
            <tr><td class="field-label">Asset Tag ID</td><td>${asset.assetTagId}</td></tr>
            <tr><td class="field-label">Purchase Date</td><td>${formatDate(asset.purchaseDate)}</td></tr>
            <tr><td class="field-label">Cost</td><td>${formatCurrency(asset.cost ? Number(asset.cost) : null)}</td></tr>
            <tr><td class="field-label">Brand</td><td>${asset.brand || 'N/A'}</td></tr>
            <tr><td class="field-label">Model</td><td>${asset.model || 'N/A'}</td></tr>
            <tr><td class="field-label">Serial No</td><td>${asset.serialNo || 'N/A'}</td></tr>
            <tr><td class="field-label">Site</td><td>${asset.site || 'N/A'}</td></tr>
            <tr><td class="field-label">Location</td><td>${asset.location || 'N/A'}</td></tr>
            <tr><td class="field-label">Category</td><td>${asset.category?.name || 'N/A'}</td></tr>
            <tr><td class="field-label">Sub-Category</td><td>${asset.subCategory?.name || 'N/A'}</td></tr>
            <tr><td class="field-label">Department</td><td>${asset.department || 'N/A'}</td></tr>
            <tr><td class="field-label">Assigned To</td><td>${assignedTo}</td></tr>
            <tr><td class="field-label">Issued To</td><td>${issuedTo}</td></tr>
            <tr><td class="field-label">Status</td><td>${asset.status || 'N/A'}</td></tr>
            <tr><td class="field-label">Owner</td><td>${asset.owner || 'N/A'}</td></tr>
            <tr><td class="field-label">PO Number</td><td>${asset.poNumber || 'N/A'}</td></tr>
            <tr><td class="field-label">Purchased From</td><td>${asset.purchasedFrom || 'N/A'}</td></tr>
            <tr><td class="field-label">Xero Asset No</td><td>${asset.xeroAssetNo || 'N/A'}</td></tr>
            <tr><td class="field-label">PBI Number</td><td>${asset.pbiNumber || 'N/A'}</td></tr>
            <tr><td class="field-label">Payment Voucher Number</td><td>${asset.paymentVoucherNumber || 'N/A'}</td></tr>
            <tr><td class="field-label">Asset Type</td><td>${asset.assetType || 'N/A'}</td></tr>
            <tr><td class="field-label">Delivery Date</td><td>${formatDate(asset.deliveryDate)}</td></tr>
            <tr><td class="field-label">Old Asset Tag</td><td>${asset.oldAssetTag || 'N/A'}</td></tr>
            <tr><td class="field-label">QR Code</td><td>${asset.qr || 'N/A'}</td></tr>
            <tr><td class="field-label">Additional Information</td><td>${asset.additionalInformation || 'N/A'}</td></tr>
            <tr><td class="field-label">Remarks</td><td>${asset.remarks || 'N/A'}</td></tr>
            <tr><td class="field-label">Unaccounted Inventory</td><td>${asset.unaccountedInventory || 'N/A'}</td></tr>
            <tr><td class="field-label">Description</td><td>${asset.description || 'N/A'}</td></tr>
            <tr><td class="field-label">Created At</td><td>${formatDate(asset.createdAt)}</td></tr>
            <tr><td class="field-label">Updated At</td><td>${formatDate(asset.updatedAt)}</td></tr>
          </table>

          <!-- Audit History Table -->
          ${asset.auditHistory && asset.auditHistory.length > 0 ? `
          <h2>Audit History</h2>
          <table>
            <tr>
              <th>Date</th>
              <th>Audit Type</th>
              <th>Status</th>
              <th>Auditor</th>
              <th>Notes</th>
            </tr>
            ${asset.auditHistory.map((audit: { auditDate: Date | string; auditType: string | null; status: string | null; auditor: string | null; notes: string | null }) => `
              <tr>
                <td>${formatDate(audit.auditDate)}</td>
                <td>${audit.auditType || 'N/A'}</td>
                <td>${audit.status || 'N/A'}</td>
                <td>${audit.auditor || 'N/A'}</td>
                <td>${audit.notes || '-'}</td>
              </tr>
            `).join('')}
          </table>
          ` : '<p><em>No audit records found.</em></p>'}

          <!-- Maintenance Table -->
          ${maintenances.length > 0 ? `
          <h2>Maintenance Records</h2>
          <table>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Date Completed</th>
              <th>Maintenance By</th>
              <th>Cost</th>
              <th>Details</th>
            </tr>
            ${maintenances.map((m: typeof maintenances[0]) => `
              <tr>
                <td>${m.title || 'N/A'}</td>
                <td>${m.status || 'N/A'}</td>
                <td>${formatDate(m.dueDate)}</td>
                <td>${formatDate(m.dateCompleted)}</td>
                <td>${m.maintenanceBy || 'N/A'}</td>
                <td>${formatCurrency(m.cost ? Number(m.cost) : null)}</td>
                <td>${m.details || '-'}</td>
              </tr>
            `).join('')}
          </table>
          ` : '<p><em>No maintenance records found.</em></p>'}

          <!-- Reserve Table -->
          ${reservations.length > 0 ? `
          <h2>Reservations</h2>
          <table>
            <tr>
              <th>Asset ID</th>
              <th>Description</th>
              <th>Type</th>
              <th>Reserved For</th>
              <th>Purpose</th>
              <th>Reservation Date</th>
            </tr>
            ${reservations.map((r: { reservationType: string; employeeUser: { name: string } | null; department: string | null; purpose: string | null; reservationDate: Date | string }) => `
              <tr>
                <td>${asset.assetTagId}</td>
                <td>${asset.description || 'N/A'}</td>
                <td>${r.reservationType || 'N/A'}</td>
                <td>${r.employeeUser?.name || r.department || 'N/A'}</td>
                <td>${r.purpose || '-'}</td>
                <td>${formatDate(r.reservationDate)}</td>
              </tr>
            `).join('')}
          </table>
          ` : '<p><em>No reservations found.</em></p>'}

          <!-- History Logs Table -->
          ${historyLogs.length > 0 ? `
          <h2>History Logs</h2>
          <table>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Field</th>
              <th>Changed From</th>
              <th>Changed To</th>
              <th>Action By</th>
            </tr>
            ${historyLogs.map((log: { eventDate: Date | string; eventType: string; field: string | null; changeFrom: string | null; changeTo: string | null; actionBy: string | null }) => `
              <tr>
                <td>${formatDate(log.eventDate)}</td>
                <td>${log.eventType || 'N/A'}</td>
                <td>${log.field ? log.field.charAt(0).toUpperCase() + log.field.slice(1) : '-'}</td>
                <td>${log.changeFrom || '(empty)'}</td>
                <td>${log.changeTo || '(empty)'}</td>
                <td>${log.actionBy || 'N/A'}</td>
              </tr>
            `).join('')}
          </table>
          ` : '<p><em>No history logs found.</em></p>'}

          <!-- Photos Table -->
          ${images.length > 0 ? `
          <h2>Photos</h2>
          <table>
            <tr>
              <th>Image</th>
              <th>Type</th>
              <th>Size</th>
              <th>Uploaded</th>
            </tr>
            ${images.map((img: { imageUrl: string; imageType: string | null; imageSize: number | null; createdAt: Date | string }) => `
              <tr>
                <td><img src="${img.imageUrl}" alt="Asset Image" /></td>
                <td>${img.imageType || 'N/A'}</td>
                <td>${img.imageSize ? `${(img.imageSize / 1024).toFixed(2)} KB` : 'N/A'}</td>
                <td>${formatDate(img.createdAt)}</td>
              </tr>
            `).join('')}
          </table>
          ` : '<p><em>No photos found.</em></p>'}

          <!-- Documents Table -->
          ${documents.length > 0 ? `
          <h2>Documents</h2>
          <table>
            <tr>
              <th>File Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>URL</th>
              <th>Uploaded</th>
            </tr>
            ${documents.map((doc: { fileName: string | null; documentType: string | null; mimeType: string | null; documentSize: number | null; documentUrl: string | null; createdAt: Date | string }) => {
              // Determine document type: use documentType if available, otherwise infer from mimeType or file extension
              let displayType = doc.documentType
              if (!displayType) {
                if (doc.mimeType) {
                  // Extract type from mimeType (e.g., "application/pdf" -> "PDF")
                  const mimeParts = doc.mimeType.split('/')
                  if (mimeParts.length > 1) {
                    const subtype = mimeParts[1].toUpperCase()
                    displayType = subtype.includes('PDF') ? 'PDF' :
                                  subtype.includes('WORD') || subtype.includes('DOC') ? 'Word Document' :
                                  subtype.includes('EXCEL') || subtype.includes('SHEET') ? 'Excel Spreadsheet' :
                                  subtype.includes('TEXT') ? 'Text File' :
                                  subtype.includes('IMAGE') ? 'Image' :
                                  subtype
                  }
                } else if (doc.fileName) {
                  // Extract type from file extension
                  const ext = doc.fileName.split('.').pop()?.toUpperCase()
                  displayType = ext === 'PDF' ? 'PDF' :
                               ext === 'DOC' || ext === 'DOCX' ? 'Word Document' :
                               ext === 'XLS' || ext === 'XLSX' ? 'Excel Spreadsheet' :
                               ext === 'TXT' ? 'Text File' :
                               ext === 'CSV' ? 'CSV File' :
                               ext === 'RTF' ? 'RTF File' :
                               ext ? `${ext} File` : 'Unknown'
                } else {
                  displayType = 'N/A'
                }
              }
              return `
              <tr>
                <td>${doc.fileName || 'N/A'}</td>
                <td>${displayType}</td>
                <td>${doc.documentSize ? `${(doc.documentSize / 1024).toFixed(2)} KB` : 'N/A'}</td>
                <td style="word-break: break-all; font-size: 8px;"><a href="${doc.documentUrl || '#'}" target="_blank">${doc.documentUrl || 'N/A'}</a></td>
                <td>${formatDate(doc.createdAt)}</td>
              </tr>
            `
            }).join('')}
          </table>
          ` : '<p><em>No documents found.</em></p>'}
        </body>
      </html>
    `

    console.log('[PDF] HTML generated. Starting browser...')
    
    // Configure Chromium for Vercel/serverless environment
    // In production: use puppeteer-core with @sparticuz/chromium (optimized for serverless)
    // In development: use full puppeteer package (includes bundled Chromium)
    const isProduction = process.env.NODE_ENV === 'production'
    console.log('[PDF] Environment:', isProduction ? 'production' : 'development')
    
    let browser: Awaited<ReturnType<typeof puppeteerCore.launch>> | Awaited<ReturnType<typeof puppeteer.launch>> | null = null
    
    try {
      if (isProduction) {
        console.log('[PDF] Using puppeteer-core with Chromium...')
        // Production: Use puppeteer-core with @sparticuz/chromium for Vercel
        // Note: This requires @sparticuz/chromium to be properly installed with all its files
        try {
          // Get chromium executable path
          // This may fail if brotli files are missing - that's a deployment configuration issue
          console.log('[PDF] Getting Chromium executable path...')
          let executablePath: string
          
          try {
            executablePath = await chromium.executablePath()
            console.log('[PDF] Chromium path:', executablePath)
          } catch (pathError) {
            console.error('[PDF] Failed to get Chromium executable path:', pathError)
            // Try to find chromium in node_modules as fallback
            const possiblePaths = [
              join(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin', 'chromium'),
              join('/var/task', 'node_modules', '@sparticuz', 'chromium', 'bin', 'chromium'),
            ]
            
            executablePath = possiblePaths.find(p => existsSync(p)) || ''
            
            if (!executablePath) {
              throw new Error(
                'Chromium executable not found. The @sparticuz/chromium package files are missing from the deployment. ' +
                'For Vercel: Ensure @sparticuz/chromium is in dependencies (not devDependencies) and redeploy. ' +
                'The package files must be included in the serverless function bundle'
              )
            }
            
            console.log('[PDF] Using fallback Chromium path:', executablePath)
          }
          
          console.log('[PDF] Launching browser...')
          browser = await puppeteerCore.launch({
            args: [
              ...chromium.args,
              '--hide-scrollbars',
              '--disable-web-security',
              '--disable-dev-shm-usage',
              '--disable-software-rasterizer',
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-gpu',
              '--single-process',
            ],
            defaultViewport: { width: 794, height: 1123 },
            executablePath,
            headless: true,
          })
        } catch (error) {
          console.error('[PDF] Failed to launch Chromium in production:', error)
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          
          // Provide helpful error message for brotli files issue
          if (errorMsg.includes('brotli') || errorMsg.includes('does not exist') || errorMsg.includes('input directory') || errorMsg.includes('not found')) {
            throw new Error(
              'Chromium deployment configuration issue: The @sparticuz/chromium package is missing required files. ' +
              'SOLUTION: In your Vercel project settings, ensure @sparticuz/chromium is in dependencies (not devDependencies). ' +
              'Then redeploy. The package binary files must be included in the serverless function bundle. ' +
              'If the issue persists, check Vercel build logs to ensure the package files are being copied.'
            )
          }
          
          throw new Error(`Failed to generate PDF: Chromium initialization failed - ${errorMsg}`)
        }
      } else {
        // Development: Use full puppeteer package (includes bundled Chromium)
        console.log('[PDF] Using full puppeteer package...')
        try {
          console.log('[PDF] Launching browser...')
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: { width: 794, height: 1123 },
          })
        } catch (error) {
          console.error('Failed to launch Puppeteer in development:', error)
          throw new Error(`Failed to generate PDF: Browser initialization failed - ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
      
      if (!browser) {
        throw new Error('Failed to generate PDF: Browser instance is null')
      }

      console.log('[PDF] Browser launched. Creating page...')
      const page = await browser.newPage()

      // Set viewport to A4 proportions
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      })

      // Set HTML content with timeout
      console.log('[PDF] Setting page content...')
      await Promise.race([
        page.setContent(html, {
          waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Page content loading timeout after 30 seconds')), 30000)
        )
      ])
      console.log('[PDF] Page content loaded.')

      // Wait for images to load
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.evaluate as any)(async (): Promise<void> => {
        const images = Array.from(document.querySelectorAll('img'))
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve()
            return new Promise<void>((resolve) => {
              img.onload = () => resolve()
              img.onerror = () => resolve()
              setTimeout(() => resolve(), 3000)
            })
          })
        )
      })

      await new Promise(resolve => setTimeout(resolve, 1000))

      // Generate PDF
      const pdfOptions: Parameters<typeof page.pdf>[0] = {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        preferCSSPageSize: false,
        displayHeaderFooter: false,
      }

      console.log('[PDF] Generating PDF...')
      await page.emulateMediaType('print')
      
      const pdf = await page.pdf(pdfOptions)
      console.log('[PDF] PDF generated, size:', pdf.length, 'bytes')

      await browser.close()
      console.log('[PDF] Browser closed.')

      const filename = `asset-details-${asset.assetTagId}-${new Date().toISOString().split('T')[0]}.pdf`
      console.log('[PDF] Returning PDF response...')
      
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      console.error('[PDF] Error in browser operations:', error)
      // Safely close browser if it exists
      if (browser) {
        try {
          await browser.close()
        } catch (closeError) {
          console.error('[PDF] Error closing browser:', closeError)
        }
      }
      throw error
    }
  } catch (error) {
    // Enhanced error logging with specific error type detection
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : 'Error'
    
    // Check for database connection errors
    const isDbError = 
      error instanceof PrismaClientKnownRequestError ||
      (error instanceof Error && (
        error.message.includes('connection pool') ||
        error.message.includes('Timed out fetching') ||
        error.message.includes("Can't reach database server") ||
        error.message.includes('P1001') ||
        error.message.includes('P2024') ||
        error.message.includes('P1017')
      ))
    
    // Check for Puppeteer/Chromium errors
    const isPuppeteerError = 
      error instanceof Error && (
        error.message.includes('Chromium') ||
        error.message.includes('Puppeteer') ||
        error.message.includes('browser') ||
        error.message.includes('executablePath') ||
        error.message.includes('brotli')
      )
    
    console.error('Error generating PDF:', {
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      isProduction: process.env.NODE_ENV === 'production',
      isDbError,
      isPuppeteerError,
      prismaCode: error instanceof PrismaClientKnownRequestError ? error.code : undefined,
    })
    
    // Return specific error messages based on error type
    let statusCode = 500
    let errorDetails = errorMessage
    
    if (isDbError) {
      statusCode = 503 // Service Unavailable
      errorDetails = 'Database connection error. Please check your database configuration and try again.'
    } else if (isPuppeteerError) {
      statusCode = 500
      if (errorMessage.includes('brotli') || errorMessage.includes('executablePath')) {
        errorDetails = 'PDF generation service configuration error. Please ensure Chromium is properly installed.'
      } else {
        errorDetails = 'Failed to initialize PDF generation service. Please try again.'
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF', 
        message: errorMessage, // Always include actual error message for debugging
        details: errorDetails,
        errorType: isDbError ? 'database' : isPuppeteerError ? 'puppeteer' : 'unknown',
        // Include stack in both dev and production for debugging
        ...(errorStack ? { stack: errorStack } : {})
      },
      { status: statusCode }
    )
  }
}