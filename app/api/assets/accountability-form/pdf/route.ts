import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function POST(request: NextRequest) {
  try {
    const { html, url, elementId, elementIds } = await request.json()

    if (!html && !url) {
      return NextResponse.json(
        { error: 'HTML content or URL is required' },
        { status: 400 }
      )
    }

    // Support both single elementId and multiple elementIds
    const targetIds = elementIds || (elementId ? [elementId] : [])
    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: 'Element ID(s) required' },
        { status: 400 }
      )
    }

    // Launch Puppeteer with Chromium for Vercel
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
    
    const browser = await puppeteer.launch({
      args: isVercel
        ? [
            ...chromium.args,
            '--hide-scrollbars',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ]
        : ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: isVercel ? chromium.defaultViewport : undefined,
      executablePath: isVercel
        ? await chromium.executablePath()
        : process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: isVercel ? chromium.headless : true,
    })

    try {
      const page = await browser.newPage()

      // Set viewport to A4 proportions (210mm x 297mm at 96 DPI ≈ 794px x 1123px)
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      })

      // Navigate to page or set content
      if (url) {
        try {
          await page.goto(url, {
            waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
            timeout: 30000,
          })
          
          if (targetIds.length > 0) {
            try {
              await Promise.all(
                targetIds.map((id: string) => page.waitForSelector(id, { 
                timeout: 20000,
                visible: true 
                }))
              )
            } catch {
              await new Promise(resolve => setTimeout(resolve, 3000))
              const missingElements = []
              for (const id of targetIds) {
                const element = await page.$(id)
              if (!element) {
                  missingElements.push(id)
                }
              }
              if (missingElements.length > 0) {
                throw new Error(`Elements ${missingElements.join(', ')} not found on page.`)
              }
            }
          }
        } catch (error) {
          if (html) {
            await page.setContent(html, {
              waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
            })
          } else {
            throw new Error(`Failed to navigate to URL: ${error instanceof Error ? error.message : 'Unknown error'}.`)
          }
        }
      } else if (html) {
        await page.setContent(html, {
          waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        })
      } else {
        return NextResponse.json(
          { error: 'HTML content or URL is required' },
          { status: 400 }
        )
      }

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

      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Verify all target elements exist and prepare for PDF
      if (targetIds.length > 0) {
        const missingElements = []
        for (const id of targetIds) {
          const element = await page.$(id)
        if (!element) {
            missingElements.push(id)
          }
        }
        if (missingElements.length > 0) {
          throw new Error(`Elements ${missingElements.join(', ')} not found.`)
        }
        
        // Hide everything except the target elements
        await page.evaluate((ids) => {
          const body = document.body
          if (body) {
            body.style.overflow = 'hidden'
            body.style.margin = '0'
            body.style.padding = '0'
            body.style.backgroundColor = '#ffffff'
            
            const container = document.createElement('div')
            container.id = 'pdf-container'
            container.style.display = 'flex'
            container.style.flexDirection = 'column'
            container.style.gap = '0'
            container.style.width = '100%'
            container.style.boxSizing = 'border-box'
            container.style.padding = '0'
            container.style.margin = '0'
            
            const targetElements: HTMLElement[] = []
            ids.forEach((id: string) => {
              const element = document.querySelector(id) as HTMLElement
              if (element) {
                const cloned = element.cloneNode(true) as HTMLElement
                cloned.id = `${id.replace('#', '')}-pdf`
                
                cloned.style.width = '100%'
                cloned.style.margin = '0'
                cloned.style.padding = '6px'
                cloned.style.backgroundColor = '#ffffff'
                cloned.style.color = '#000000'
                cloned.style.boxSizing = 'border-box'
                cloned.style.position = 'relative'
                cloned.style.overflow = 'visible'
                cloned.style.pageBreakAfter = 'auto'
                cloned.style.pageBreakInside = 'avoid'
                cloned.style.marginBottom = '0'
                
                targetElements.push(cloned)
                container.appendChild(cloned)
              }
            })
            
            body.innerHTML = ''
            body.appendChild(container)
            
            // Process all target elements for styling
            targetElements.forEach((targetElement) => {
            // Fix responsive styles for PDF
            const allDivs = targetElement.querySelectorAll('div')
            allDivs.forEach((div) => {
              const htmlDiv = div as HTMLElement
              const classList = htmlDiv.className || ''
              if (htmlDiv.querySelector('table') && (classList.includes('overflow') || classList.includes('overflow-x'))) {
                htmlDiv.style.setProperty('overflow', 'visible', 'important')
                htmlDiv.style.setProperty('overflow-x', 'visible', 'important')
                htmlDiv.style.setProperty('overflow-y', 'visible', 'important')
              }
            })
            
            // Remove min-width constraints from tables
            const tables = targetElement.querySelectorAll('table')
            tables.forEach((table) => {
              const htmlTable = table as HTMLElement
              const classList = htmlTable.className || ''
              if (classList.includes('min-w')) {
                htmlTable.style.setProperty('min-width', '0', 'important')
              }
              htmlTable.style.setProperty('width', '100%', 'important')
            })
            
            // Ensure grid layouts use desktop breakpoints
            const grids = targetElement.querySelectorAll('[class*="grid"]')
            grids.forEach((grid) => {
              const htmlGrid = grid as HTMLElement
              const classList = htmlGrid.className || ''
              if (classList.includes('grid-cols-1') && classList.includes('md:grid-cols-2')) {
                htmlGrid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important')
              } else if (classList.includes('grid-cols-1') && classList.includes('sm:grid-cols-2')) {
                htmlGrid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important')
              }
            })
            
            // Ensure responsive padding uses desktop values
            const allElementsForPadding = targetElement.querySelectorAll('*')
            allElementsForPadding.forEach((el) => {
              const htmlEl = el as HTMLElement
              const classList = htmlEl.className || ''
              if (classList.includes('p-4') && (classList.includes('sm:p-6') || classList.includes('md:p-8'))) {
                htmlEl.style.setProperty('padding', '2rem', 'important')
              }
            })
            
            // Ensure responsive font sizes use desktop values
            const allElementsForFontSize = targetElement.querySelectorAll('*')
            allElementsForFontSize.forEach((el) => {
              const htmlEl = el as HTMLElement
              const classList = htmlEl.className || ''
              if (classList.includes('text-[10px]') && classList.includes('sm:text-xs')) {
                htmlEl.style.setProperty('font-size', '0.75rem', 'important')
              }
            })
            
            // Ensure all borders are visible and handle background logo opacity
            const allElements = targetElement.querySelectorAll('*')
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement
              
              // Check if this is the background logo div by checking:
              // 1. Has backgroundImage style
              // 2. Is positioned absolutely
              // 3. Has z-index 0 or is pointer-events-none
              const styleAttr = htmlEl.getAttribute('style') || ''
              const computedStyle = window.getComputedStyle(htmlEl)
              const bgImage = computedStyle.backgroundImage || styleAttr
              const position = computedStyle.position || ''
              const zIndex = computedStyle.zIndex || ''
              const pointerEvents = computedStyle.pointerEvents || ''
              const elClassList = htmlEl.className || ''
              
              // Check if it's a background logo div
              const hasBackgroundImage = bgImage && bgImage !== 'none' && (bgImage.includes('url(') || styleAttr.includes('backgroundImage'))
              const isAbsolute = position === 'absolute' || elClassList.includes('absolute')
              const isBackgroundLayer = zIndex === '0' || elClassList.includes('z-0') || pointerEvents === 'none' || elClassList.includes('pointer-events-none')
              const isBackgroundLogo = hasBackgroundImage && isAbsolute && isBackgroundLayer
              
              htmlEl.style.visibility = 'visible'
              
              // Set opacity - keep background logo at 0.03 (3%), others normal
              if (isBackgroundLogo) {
                htmlEl.style.opacity = '0.03' // 3% opacity for background logo
                htmlEl.style.setProperty('opacity', '0.03', 'important') // Force with !important
              } else {
                htmlEl.style.opacity = '1'
              }
              
              // Ensure borders are visible
              const classList = htmlEl.className || ''
              if (classList.includes('border-2') || classList.includes('border-b') || classList.includes('border-b-2') || classList.includes('border-r-2')) {
                htmlEl.style.setProperty('border-color', '#000000', 'important')
                htmlEl.style.setProperty('border-style', 'solid', 'important')
                if (classList.includes('border-2')) {
                  const containsTable = htmlEl.querySelector('table') !== null
                  if (containsTable) {
                    htmlEl.style.setProperty('border-width', '0.5px', 'important')
                  } else {
                    htmlEl.style.setProperty('border-width', '1px', 'important')
                  }
                } else if (classList.includes('border-b-2')) {
                  htmlEl.style.setProperty('border-bottom-width', '0.5px', 'important')
                  htmlEl.style.setProperty('border-top-width', '0', 'important')
                  htmlEl.style.setProperty('border-left-width', '0', 'important')
                  htmlEl.style.setProperty('border-right-width', '0', 'important')
                } else if (classList.includes('border-r-2')) {
                  htmlEl.style.setProperty('border-right-width', '0.5px', 'important')
                } else if (classList.includes('border-b')) {
                  htmlEl.style.setProperty('border-bottom-width', '0.5px', 'important')
                  htmlEl.style.setProperty('border-top-width', '0', 'important')
                  htmlEl.style.setProperty('border-left-width', '0', 'important')
                  htmlEl.style.setProperty('border-right-width', '0', 'important')
                }
              }
              
              // Reduce table cell borders
              if (htmlEl.tagName === 'TD' || htmlEl.tagName === 'TH') {
                const classList = htmlEl.className || ''
                const row = htmlEl.parentElement as HTMLTableRowElement
                const table = row?.closest('table')
                
                if (table) {
                  const cells = Array.from(row.cells)
                  const cellElement = htmlEl as HTMLTableCellElement
                  const cellIndex = cells.indexOf(cellElement)
                  const isLastColumn = cellIndex === cells.length - 1
                  
                  const rows = Array.from(table.rows)
                  const rowIndex = rows.indexOf(row)
                  const isLastRow = rowIndex === rows.length - 1
                  
                  htmlEl.style.setProperty('border-style', 'solid', 'important')
                  htmlEl.style.setProperty('border-color', '#000000', 'important')
                  
                  if (isLastColumn) {
                    htmlEl.style.setProperty('border-right-width', '0', 'important')
                  } else if (classList.includes('border-r-2')) {
                    htmlEl.style.setProperty('border-right-width', '0.5px', 'important')
                  } else {
                    htmlEl.style.setProperty('border-right-width', '0', 'important')
                  }
                  
                  if (isLastRow) {
                    htmlEl.style.setProperty('border-bottom-width', '0', 'important')
                  } else if (classList.includes('border-b-2')) {
                    htmlEl.style.setProperty('border-bottom-width', '0.5px', 'important')
                  } else if (classList.includes('border-b')) {
                    htmlEl.style.setProperty('border-bottom-width', '0.5px', 'important')
                  } else {
                    htmlEl.style.setProperty('border-bottom-width', '0', 'important')
                  }
                  
                  const colspan = cellElement.colSpan || 1
                  const isColspanCell = colspan > 1
                  if (isColspanCell) {
                    htmlEl.style.setProperty('border-left-width', '0.5px', 'important')
                  } else {
                    htmlEl.style.setProperty('border-left-width', '0', 'important')
                  }
                  
                  htmlEl.style.setProperty('border-top-width', '0', 'important')
                } else {
                  htmlEl.style.setProperty('border-width', '0.5px', 'important')
                  htmlEl.style.setProperty('border-style', 'solid', 'important')
                  htmlEl.style.setProperty('border-color', '#000000', 'important')
                }
              }
              
              // Balanced font size for title - slightly smaller
              if (htmlEl.tagName === 'H2') {
                const classList = htmlEl.className || ''
                if (classList.includes('text-sm') || classList.includes('text-base') || htmlEl.textContent?.includes('ACCOUNTABILITY FORM')) {
                  htmlEl.style.fontSize = '0.8rem'
                  htmlEl.style.lineHeight = '1rem'
                  htmlEl.style.fontWeight = 'bold'
                }
              }
              
              // Balanced font size for labels and values - slightly smaller
              if (htmlEl.tagName === 'P' || htmlEl.tagName === 'DIV' || htmlEl.tagName === 'SPAN') {
                const classList = htmlEl.className || ''
                let isInEmployeeDetailsCard = false
                let currentParent = htmlEl.parentElement
                while (currentParent && currentParent !== document.body) {
                  if (currentParent.classList.contains('border-2')) {
                    const hasGrid = currentParent.querySelector('.grid.grid-cols-2')
                    if (hasGrid) {
                      isInEmployeeDetailsCard = true
                      break
                    }
                  }
                  currentParent = currentParent.parentElement
                }
                
                if (classList.includes('text-xs') || isInEmployeeDetailsCard) {
                  if (isInEmployeeDetailsCard) {
                    htmlEl.style.fontSize = '0.65rem'
                    htmlEl.style.lineHeight = '0.85rem'
                  } else if (classList.includes('text-xs')) {
                    htmlEl.style.fontSize = '0.7rem'
                    htmlEl.style.lineHeight = '0.9rem'
                  }
                }
              }
              
              // Balanced font size and padding for table cells - slightly smaller
              if (htmlEl.tagName === 'TD' || htmlEl.tagName === 'TH') {
                const classList = htmlEl.className || ''
                // Balanced font size for table cells
                if (classList.includes('text-xs') || classList.includes('text-[10px]')) {
                  htmlEl.style.fontSize = '0.65rem'
                  htmlEl.style.lineHeight = '0.85rem'
                } else {
                  // Default balanced font for table cells
                  htmlEl.style.fontSize = '0.7rem'
                  htmlEl.style.lineHeight = '0.9rem'
                }
                // Balanced padding
                if (classList.includes('py-0.5')) {
                  htmlEl.style.paddingTop = '2px'
                  htmlEl.style.paddingBottom = '2px'
                  htmlEl.style.paddingLeft = '5px'
                  htmlEl.style.paddingRight = '5px'
                } else if (classList.includes('p-2') && !classList.includes('py-0.5')) {
                  htmlEl.style.padding = '5px'
                } else if (classList.includes('py-1')) {
                  htmlEl.style.paddingTop = '3px'
                  htmlEl.style.paddingBottom = '3px'
                  htmlEl.style.paddingLeft = '5px'
                  htmlEl.style.paddingRight = '5px'
                } else {
                  // Default balanced padding
                  htmlEl.style.paddingTop = '2px'
                  htmlEl.style.paddingBottom = '2px'
                  htmlEl.style.paddingLeft = '5px'
                  htmlEl.style.paddingRight = '5px'
                }
              }
            })
            }) // End forEach for targetElements
          }
        }, targetIds)
      }

      // Always use A4 size with balanced margins
      const pdfOptions: Parameters<typeof page.pdf>[0] = {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '8mm',
          right: '8mm',
          bottom: '8mm',
          left: '8mm',
        },
        preferCSSPageSize: false,
        displayHeaderFooter: false,
      }

      await page.emulateMediaType('print')
      
      const pdf = await page.pdf(pdfOptions)

      await browser.close()

      const filename = 'accountability-form.pdf'
      
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      await browser.close()
      throw error
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : undefined,
    })
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF', 
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    )
  }
}

