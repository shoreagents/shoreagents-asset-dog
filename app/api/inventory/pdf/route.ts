import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import puppeteerCore from 'puppeteer-core'
import * as fs from 'fs'
import * as path from 'path'
import { verifyAuth } from '@/lib/auth-utils'

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
  if (depth > 3) return null
  
  try {
    if (!fs.existsSync(dir)) return null
    
    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isFile()) {
        const fileName = path.basename(fullPath).toLowerCase()
        if (
          fileName === 'chrome.exe' ||
          fileName === 'chrome' ||
          fileName === 'google-chrome' ||
          fileName === 'chromium' ||
          fileName === 'chromium-browser'
        ) {
          return fullPath
        }
      } else if (stat.isDirectory()) {
        const result = findChromeExecutable(fullPath, depth + 1)
        if (result) return result
      }
    }
  } catch {
    // Ignore errors
  }
  
  return null
}

export async function POST(request: NextRequest) {
  // Check authentication
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { html } = await request.json()

    if (!html) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      )
    }

    let browser
    let executablePath: string | undefined

    if (chromium) {
      // Using @sparticuz/chromium for Vercel
      executablePath = await chromium.executablePath()
      
      const args = chromium.args || [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ]

      browser = await puppeteerCore.launch({
        executablePath,
        args,
        headless: true,
      })
    } else {
      // Development/local environment
      const searchPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application',
        '/usr/bin',
        '/usr/local/bin',
        '/Applications/Google Chrome.app/Contents/MacOS',
        process.env.CHROME_PATH || '',
      ].filter(Boolean)

      for (const searchPath of searchPaths) {
        const found = findChromeExecutable(searchPath)
        if (found) {
          executablePath = found
          break
        }
      }

      if (!executablePath) {
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          })
        } catch (launchError) {
          console.error('Failed to launch default puppeteer:', launchError)
          return NextResponse.json(
            { 
              error: 'Chrome/Chromium not found',
              details: 'Please install Chrome or set CHROME_PATH environment variable'
            },
            { status: 500 }
          )
        }
      } else {
        browser = await puppeteerCore.launch({
          executablePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
      }
    }

    try {
      const page = await browser.newPage()
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 60000
      })

      const pdfOptions: Parameters<typeof page.pdf>[0] = {
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        timeout: 60000,
      }

      await page.emulateMediaType('print')
      
      const pdfData = await page.pdf(pdfOptions)
      
      const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData)

      try {
        await browser.close()
      } catch {
        // Ignore errors when closing browser
      }

      const filename = `inventory-report-${new Date().toISOString().split('T')[0]}.pdf`
      const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      
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

