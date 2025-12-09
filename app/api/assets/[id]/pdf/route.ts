import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import puppeteerCore from 'puppeteer-core'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

// For Vercel/serverless, use lightweight Chromium
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chromium: any = null
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    chromium = require('@sparticuz/chromium')
    // Configure for serverless
    if (chromium && typeof chromium.setGraphicsMode === 'function') {
      chromium.setGraphicsMode(false)
    }
  } catch {
    // @sparticuz/chromium not available, will use regular puppeteer
  }
}

// Helper function to recursively find chrome executable in a directory
function findChromeExecutable(dir: string, depth: number = 0): string | null {
  if (depth > 4) return null // Limit recursion depth
  
  try {
    if (!fs.existsSync(dir)) return null
    
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      // Check if this is the chrome executable
      if (entry.isFile() && (entry.name === 'chrome' || entry.name === 'chrome.exe')) {
        // On Unix systems, check if it's executable
        try {
          if (process.platform !== 'win32') {
            fs.accessSync(fullPath, fs.constants.X_OK)
          }
          return fullPath
        } catch {
          // Not executable or access check failed, continue searching
          continue
        }
      }
      
      // Recursively search in subdirectories (skip hidden and node_modules)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const found = findChromeExecutable(fullPath, depth + 1)
        if (found) return found
      }
    }
  } catch {
    // Ignore errors and continue
  }
  
  return null
}

// Helper function to get Chromium executable path
async function getChromiumPath(): Promise<string | null> {
  // For Vercel/serverless, use @sparticuz/chromium-min
  if (chromium && (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
    try {
      const chromiumPath = await chromium.executablePath()
      if (chromiumPath && fs.existsSync(chromiumPath)) {
        return chromiumPath
      }
    } catch {
      // Failed to get @sparticuz/chromium-min path
    }
  }

  // On Windows, prioritize system Chrome over Puppeteer Chromium for better stability
  if (process.platform === 'win32') {
    const systemChromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
      process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : '',
      process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe` : '',
    ].filter(Boolean) as string[]
    
    for (const chromePath of systemChromePaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath
      }
    }
  }

  try {
    // Try to use Puppeteer's bundled Chromium
    const puppeteerChromiumPath = puppeteer.executablePath()
    if (puppeteerChromiumPath) {
      // Check if the exact path exists
      if (fs.existsSync(puppeteerChromiumPath)) {
        return puppeteerChromiumPath
      }
      
      // If the exact path doesn't exist, try to find chrome in the parent directory
      const parentDir = path.dirname(puppeteerChromiumPath)
      if (fs.existsSync(parentDir)) {
        const found = findChromeExecutable(parentDir)
        if (found) {
          return found
        }
      }
      
      // Try to find in the cache directory structure (Vercel/Linux)
      const cacheBases = [
        '/home/sbx_user1051/.cache/puppeteer', // Vercel default
        path.join(process.env.HOME || '', '.cache', 'puppeteer'), // Linux home
        '/tmp/.cache/puppeteer', // Alternative temp location
      ]
      
      for (const cacheBase of cacheBases) {
        if (cacheBase && fs.existsSync(cacheBase)) {
          const found = findChromeExecutable(cacheBase)
          if (found) {
            return found
          }
        }
      }
      
      // For Vercel, also try to find in node_modules/.cache
      if (process.env.VERCEL) {
        const nodeModulesCache = path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer')
        if (fs.existsSync(nodeModulesCache)) {
          const found = findChromeExecutable(nodeModulesCache)
          if (found) {
            return found
          }
        }
      }
    }
  } catch {
    // Puppeteer bundled Chromium not found, trying alternatives
  }

  // Try environment variable
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }

  // Try common system locations (prioritize system Chrome on Windows for stability)
  const commonPaths = [
    // Windows - try system Chrome first (more stable than Puppeteer Chromium)
    ...(process.platform === 'win32' ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
      process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : '',
      process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe` : '',
    ].filter(Boolean) : []),
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]

  for (const chromePath of commonPaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath
    }
  }

  // Last resort: search in various cache directories
  const lastResortPaths = [
    '/home/sbx_user1051/.cache/puppeteer', // Vercel default
    path.join(process.env.HOME || '', '.cache', 'puppeteer'), // Linux home
    '/tmp/.cache/puppeteer', // Temp location
  ]
  
  if (process.env.VERCEL) {
    lastResortPaths.push(
      path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer'),
      path.join('/tmp', 'puppeteer'),
    )
  }
  
  for (const cacheBase of lastResortPaths) {
    if (cacheBase && fs.existsSync(cacheBase)) {
      const found = findChromeExecutable(cacheBase)
      if (found) {
        return found
      }
    }
  }

  return null
}

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

const formatDateTime = (date: string | Date | null | undefined) => {
  if (!date) return 'N/A'
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
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
    const { id } = await params
    // Parse request body for PDF sections selection
    const body = await request.json().catch(() => ({}))
    const sections = body.sections || {
      basicDetails: true,
      checkout: true,
      creation: true,
      auditHistory: true,
      maintenance: true,
      reservations: true,
      historyLogs: true,
      photos: true,
      documents: true,
    }

    // Fetch all asset data
    const asset = await prisma.assets.findFirst({
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

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Fetch related data
    const [images, documents, maintenances, reservations, historyLogs] = await Promise.all([
      prisma.assetsImage.findMany({
        where: { assetTagId: asset.assetTagId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assetsDocument.findMany({
        where: { assetTagId: asset.assetTagId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assetsMaintenance.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assetsReserve.findMany({
        where: {
          assetId: asset.id,
          reservationDate: { gte: new Date() },
        },
        include: {
          employeeUser: true,
        },
        orderBy: { reservationDate: 'asc' },
      }),
      prisma.assetsHistoryLogs.findMany({
        where: { assetId: asset.id },
        orderBy: { eventDate: 'desc' },
      }),
    ])

    // Find active checkout
    const activeCheckout = asset.checkouts?.find(
      (checkout) => (checkout.checkins?.length ?? 0) === 0
    )

    const assignedTo = activeCheckout?.employeeUser?.name || 'N/A'
    const issuedTo = asset.issuedTo || 'N/A'

    // Find the creator from history logs (eventType: 'added')
    const creationLog = historyLogs.find((log: { eventType: string }) => log.eventType === 'added')
    const createdBy = creationLog?.actionBy || 'N/A'

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

          ${sections.basicDetails ? `
          <!-- Basic Details Table -->
          <h2>Basic Details</h2>
          <table>
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
          </table>
          ` : ''}

          ${sections.checkout && activeCheckout ? `
          <!-- Check out Section -->
          <h2>Check out</h2>
          <table>
            <tr><td class="field-label">Checkout Date</td><td>${formatDate(activeCheckout.checkoutDate)}</td></tr>
            <tr><td class="field-label">Expected Return Date</td><td>${activeCheckout.expectedReturnDate ? formatDate(activeCheckout.expectedReturnDate) : 'N/A'}</td></tr>
            ${activeCheckout.employeeUser ? `
            <tr><td class="field-label">Assigned To</td><td>${activeCheckout.employeeUser.name || 'N/A'}</td></tr>
            ${activeCheckout.employeeUser.email ? `<tr><td class="field-label">Employee Email</td><td>${activeCheckout.employeeUser.email}</td></tr>` : ''}
            ${activeCheckout.employeeUser.department ? `<tr><td class="field-label">Department</td><td>${activeCheckout.employeeUser.department}</td></tr>` : ''}
            ` : ''}
          </table>
          ` : ''}

          ${sections.creation ? `
          <!-- Creation Section -->
          <h2>Creation</h2>
          <table>
            <tr><td class="field-label">Created By</td><td>${createdBy}</td></tr>
            <tr><td class="field-label">Created At</td><td>${formatDateTime(asset.createdAt)}</td></tr>
            <tr><td class="field-label">Updated At</td><td>${formatDateTime(asset.updatedAt)}</td></tr>
          </table>
          ` : ''}

          ${sections.auditHistory && asset.auditHistory && asset.auditHistory.length > 0 ? `
          <!-- Audit History Table -->
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
          ` : ''}

          ${sections.maintenance && maintenances.length > 0 ? `
          <!-- Maintenance Table -->
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
          ` : ''}

          ${sections.reservations && reservations.length > 0 ? `
          <!-- Reserve Table -->
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
          ` : ''}

          ${sections.historyLogs && historyLogs.length > 0 ? `
          <!-- History Logs Table -->
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
          ` : ''}

          ${sections.photos && images.length > 0 ? `
          <!-- Photos Table -->
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
          ` : ''}

          ${sections.documents && documents.length > 0 ? `
          <!-- Documents Table -->
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

    // Launch browser with optimized settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        // Windows-specific: Don't use --single-process as it can cause ECONNRESET
        // Use it only for serverless environments (not Windows local dev)
        ...(process.platform !== 'win32' && (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) 
          ? ['--single-process'] 
          : []),
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-notifications',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-speech-api',
        '--disable-sync',
        '--disable-translate',
        '--disable-windows10-custom-titlebar',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pings',
        '--no-zygote',
        '--safebrowsing-disable-auto-update',
        '--use-mock-keychain',
      ],
      timeout: 60000, // 60 second timeout for browser launch
    }

    try {
      // Try to find Chromium executable
      const chromiumPath = await getChromiumPath()
      if (chromiumPath) {
        launchOptions.executablePath = chromiumPath
      } else {
        // For Vercel, try to use Puppeteer's default path
        try {
          const defaultPath = puppeteer.executablePath()
          if (defaultPath) {
            launchOptions.executablePath = defaultPath
          }
        } catch {
          // Could not get Puppeteer default path
        }
      }
      
      // Verify executable path exists
      if (launchOptions.executablePath && !fs.existsSync(launchOptions.executablePath)) {
        const windowsCacheBase = process.platform === 'win32' 
          ? path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE || '', '.cache', 'puppeteer')
          : '/home/sbx_user1051/.cache/puppeteer'
        
        if (fs.existsSync(windowsCacheBase)) {
          const found = findChromeExecutable(windowsCacheBase)
          if (found) {
            launchOptions.executablePath = found
          }
        }
      } else if (!launchOptions.executablePath) {
        try {
          const defaultPath = puppeteer.executablePath()
          if (defaultPath && fs.existsSync(defaultPath)) {
            launchOptions.executablePath = defaultPath
          }
        } catch {
          // Could not get Puppeteer default path
        }
      }

      // On Windows, verify the executable exists and is accessible
      if (process.platform === 'win32' && launchOptions.executablePath) {
        if (!fs.existsSync(launchOptions.executablePath)) {
          throw new Error(`Chrome executable not found at: ${launchOptions.executablePath}`)
        }
      }

      // For Vercel/serverless, use puppeteer-core with @sparticuz/chromium
      if (chromium && (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
        try {
          // Get executable path - chromium handles extraction automatically
          const chromiumPath = await chromium.executablePath()
          
          // Merge args - chromium provides optimized args for serverless
          const chromiumArgs = chromium.args || []
          launchOptions.args = [...chromiumArgs, ...launchOptions.args]
          launchOptions.executablePath = chromiumPath
          launchOptions.headless = chromium.headless !== false // Default to headless
          
          browser = await puppeteerCore.launch(launchOptions)
        } catch (chromiumError) {
          // Fallback to regular puppeteer if chromium fails
          throw chromiumError
        }
      } else {
        // Launch with increased timeout for Windows
        const launchTimeout = process.platform === 'win32' ? 90000 : 60000
        launchOptions.timeout = launchTimeout

        browser = await puppeteer.launch(launchOptions)
      }
    } catch (launchError) {
      console.error('Failed to launch browser:', launchError)
      
      // Extract error message more thoroughly
      let errorMessage = 'Unknown error'
      if (launchError instanceof Error) {
        errorMessage = launchError.message || launchError.toString()
      } else if (typeof launchError === 'string') {
        errorMessage = launchError
      } else if (launchError && typeof launchError === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errorMessage = (launchError as any).message || 
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (launchError as any).toString() || 
                      JSON.stringify(launchError)
      }
      
      const errorStack = launchError instanceof Error ? launchError.stack : undefined
      
      // Try to provide more helpful error message
      let hint = 'Puppeteer requires Chrome/Chromium. '
      if (errorMessage.includes('ECONNRESET') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('read ECONNRESET')) {
        hint = 'Chrome connection was reset - Chrome may have crashed during startup. '
        if (process.platform === 'win32') {
          hint += 'Solutions: 1) Close all Chrome/Chromium windows, 2) Check if Windows Defender/antivirus is blocking Chrome, 3) Restart your dev server, 4) Try using system Chrome instead (install Google Chrome browser).'
        } else {
          hint += 'Try: 1) Kill any existing Chrome processes (killall chrome), 2) Restart your dev server, 3) Try again.'
        }
      } else if (errorMessage.includes('executable') || 
          errorMessage.includes('chrome') || 
          errorMessage.includes('Could not find Chrome') ||
          errorMessage.includes('Browser was not found')) {
        if (process.env.VERCEL) {
          hint += 'For Vercel deployments, add this to your package.json build script: "build": "npx puppeteer browsers install chrome && next build". Or set CHROME_PATH environment variable in Vercel dashboard.'
        } else if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
          hint += 'For AWS Lambda, you need to bundle Chromium with your deployment or use a Lambda layer with Chromium.'
        } else {
          hint += 'For local development: 1) Install Google Chrome browser, OR 2) Run: npx puppeteer browsers install chrome, then restart your dev server.'
        }
      } else if (errorMessage.includes('timeout')) {
        hint += 'Browser launch timed out. This might be due to system resource constraints.'
      } else {
        hint += 'Check server logs for more details.'
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to launch browser',
          details: errorMessage,
          hint: hint,
          executablePath: launchOptions.executablePath || 'not set',
          ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {})
        },
        { status: 500 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let page: any = null
    try {
      page = await browser.newPage()

      // Set viewport to A4 proportions
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      })

      // Set HTML content
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: 60000, // Increased timeout
      })

      // Wait for images to load
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('img'))
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve()
            return new Promise((resolve) => {
              img.onload = resolve
              img.onerror = resolve
              setTimeout(resolve, 3000)
            })
          })
        )
      })

      // Wait for fonts and images to load
      try {
        await page.evaluate(() => document.fonts.ready)
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch {
        // Continue anyway if fonts fail to load
      }

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
        timeout: 60000, // 60 second timeout
      }

      await page.emulateMediaType('print')
      
      const pdfData = await page.pdf(pdfOptions)
      
      // Convert Uint8Array to Buffer if needed
      const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData)

      // Close browser
      try {
        await browser.close()
      } catch {
        // Ignore errors when closing browser
      }

      const filename = `asset-details-${asset.assetTagId}-${new Date().toISOString().split('T')[0]}.pdf`
      const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      
      // Convert to Uint8Array for NextResponse compatibility
      const pdfArray = Buffer.isBuffer(pdfBuffer) ? new Uint8Array(pdfBuffer) : pdfBuffer
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new NextResponse(pdfArray as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${sanitizedFileName}"; filename*=UTF-8''${encodeURIComponent(sanitizedFileName)}`,
          'Content-Length': pdfBuffer.length.toString(),
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (pageError) {
      console.error('Failed to create page or generate PDF:', pageError)
      if (browser) {
        try {
          await browser.close()
        } catch {
          // Ignore errors when closing browser
        }
      }
      throw pageError
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}