import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

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

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
      const page = await browser.newPage()

      // Set viewport to A4 proportions (210mm x 297mm at 96 DPI ≈ 794px x 1123px)
      // Using slightly larger for better rendering quality
      await page.setViewport({
        width: 794, // A4 width at 96 DPI (210mm / 25.4 * 96)
        height: 1123, // A4 height at 96 DPI (297mm / 25.4 * 96)
        deviceScaleFactor: 2, // Higher DPI for better quality
      })

      // Navigate to page or set content
      if (url) {
        try {
          // Navigate to the actual page URL - this ensures all styles are loaded
          // Note: This requires the page to be publicly accessible or handle auth
          await page.goto(url, {
            waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
            timeout: 30000,
          })
          
          // Wait for React to hydrate and render the component
          // Wait for all target elements with a longer timeout
          if (targetIds.length > 0) {
            try {
              await Promise.all(
                targetIds.map((id: string) => page.waitForSelector(id, { 
                timeout: 20000,
                visible: true 
                }))
              )
            } catch {
              // If selector not found, try waiting a bit more for React hydration
              await new Promise(resolve => setTimeout(resolve, 3000))
              const missingElements = []
              for (const id of targetIds) {
                const element = await page.$(id)
              if (!element) {
                  missingElements.push(id)
                }
              }
              if (missingElements.length > 0) {
                throw new Error(`Elements ${missingElements.join(', ')} not found on page. The page may require authentication or the elements may not be rendered.`)
              }
            }
          }
        } catch (error) {
          // If URL navigation fails, fall back to HTML if provided
          if (html) {
            await page.setContent(html, {
              waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
            })
          } else {
            throw new Error(`Failed to navigate to URL: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the page is accessible or provide HTML content.`)
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
              img.onerror = resolve // Continue even if image fails
              setTimeout(resolve, 3000) // Timeout after 3 seconds
            })
          })
        )
      })

      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready')
      
      // Wait a bit more for any dynamic content and CSS to apply
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
          throw new Error(`Elements ${missingElements.join(', ')} not found. Please ensure the elements exist on the page.`)
        }
        
        // Hide everything except the target elements and arrange them side-by-side
        await page.evaluate((ids) => {
          // Hide all body children except the target elements
          const body = document.body
          if (body) {
            body.style.overflow = 'hidden'
            body.style.margin = '0'
            body.style.padding = '0'
            body.style.backgroundColor = '#ffffff'
            
            // Create a container for vertical stacked layout
            const container = document.createElement('div')
            container.id = 'pdf-container'
            container.style.display = 'flex'
            container.style.flexDirection = 'column'
            container.style.gap = '0'
            container.style.width = '100%'
            container.style.boxSizing = 'border-box'
            container.style.padding = '4px'
            
            // Find and move all target elements to container
            const targetElements: HTMLElement[] = []
            ids.forEach((id: string) => {
              const element = document.querySelector(id) as HTMLElement
              if (element) {
                // Clone the element to avoid removing from original location
                const cloned = element.cloneNode(true) as HTMLElement
                cloned.id = `${id.replace('#', '')}-pdf`
                
                // Style each form for vertical stacked layout
                cloned.style.width = '100%'
                cloned.style.margin = '0'
                cloned.style.padding = '8px'
                cloned.style.backgroundColor = '#ffffff'
                cloned.style.color = '#000000'
                cloned.style.boxSizing = 'border-box'
                cloned.style.position = 'relative'
                cloned.style.overflow = 'hidden'
                cloned.style.pageBreakAfter = 'auto'
                cloned.style.pageBreakInside = 'avoid'
                cloned.style.marginBottom = '4px' // Small gap between forms
                
                targetElements.push(cloned)
                container.appendChild(cloned)
              }
            })
            
            // Clear body and add container
              body.innerHTML = ''
            body.appendChild(container)
            
            // Process all target elements for styling
            targetElements.forEach((targetElement) => {
            
            // Fix responsive styles for PDF - remove overflow and min-width constraints
            // Find all divs that contain tables (table containers)
            const allDivs = targetElement.querySelectorAll('div')
            allDivs.forEach((div) => {
              const htmlDiv = div as HTMLElement
              const classList = htmlDiv.className || ''
              // Check if this div contains a table and has overflow classes
              if (htmlDiv.querySelector('table') && (classList.includes('overflow') || classList.includes('overflow-x'))) {
                htmlDiv.style.setProperty('overflow', 'visible', 'important')
                htmlDiv.style.setProperty('overflow-x', 'visible', 'important')
                htmlDiv.style.setProperty('overflow-y', 'visible', 'important')
              }
            })
            
            // Remove min-width constraints from tables for PDF
            const tables = targetElement.querySelectorAll('table')
            tables.forEach((table) => {
              const htmlTable = table as HTMLElement
              const classList = htmlTable.className || ''
              // Remove min-width if present
              if (classList.includes('min-w')) {
                htmlTable.style.setProperty('min-width', '0', 'important')
              }
              htmlTable.style.setProperty('width', '100%', 'important')
            })
            
            // Ensure grid layouts use desktop breakpoints (2 columns) for PDF
            const grids = targetElement.querySelectorAll('[class*="grid"]')
            grids.forEach((grid) => {
              const htmlGrid = grid as HTMLElement
              const classList = htmlGrid.className || ''
              // If it has responsive grid-cols-1 sm:grid-cols-2, force 2 columns for PDF
              if (classList.includes('grid-cols-1') && classList.includes('md:grid-cols-2')) {
                htmlGrid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important')
              } else if (classList.includes('grid-cols-1') && classList.includes('sm:grid-cols-2')) {
                htmlGrid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important')
              }
            })
            
            // Ensure responsive padding uses desktop values for PDF
            // Find elements with responsive padding classes (p-4 sm:p-6 md:p-8)
            const allElementsForPadding = targetElement.querySelectorAll('*')
            allElementsForPadding.forEach((el) => {
              const htmlEl = el as HTMLElement
              const classList = htmlEl.className || ''
              // Check if element has responsive padding pattern
              if (classList.includes('p-4') && (classList.includes('sm:p-6') || classList.includes('md:p-8'))) {
                // Use md:p-8 value (2rem / 32px) for PDF
                htmlEl.style.setProperty('padding', '2rem', 'important')
              }
            })
            
            // Ensure responsive font sizes use desktop values (sm:text-xs should use text-xs)
            const allElementsForFontSize = targetElement.querySelectorAll('*')
            allElementsForFontSize.forEach((el) => {
              const htmlEl = el as HTMLElement
              const classList = htmlEl.className || ''
              // If element has text-[10px] sm:text-xs, use text-xs (0.75rem) for PDF
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
              
              // Force visibility
              htmlEl.style.visibility = 'visible'
              
              // Set opacity - keep background logo at 0.03 (3%), others normal
              if (isBackgroundLogo) {
                htmlEl.style.opacity = '0.03' // 3% opacity for background logo
                htmlEl.style.setProperty('opacity', '0.03', 'important') // Force with !important
              } else {
                htmlEl.style.opacity = '1'
              }
              
              // Ensure borders are visible (especially for employee details box and table wrappers)
              // Use setProperty with 'important' to override CSS !important rules
              const classList = htmlEl.className || ''
              if (classList.includes('border-2') || classList.includes('border-b') || classList.includes('border-b-2') || classList.includes('border-r-2')) {
                htmlEl.style.setProperty('border-color', '#000000', 'important')
                htmlEl.style.setProperty('border-style', 'solid', 'important')
                if (classList.includes('border-2')) {
                  // Check if this is a table wrapper (contains a table element)
                  const containsTable = htmlEl.querySelector('table') !== null
                  if (containsTable) {
                    // Use thinner border for table wrappers to avoid double-thick appearance
                    htmlEl.style.setProperty('border-width', '0.5px', 'important')
                  } else {
                    // Use standard border for other elements (like employee details box)
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
              // Reduce table cell borders - avoid duplicating wrapper div borders
              // Use setProperty with 'important' to override CSS !important rules
              if (htmlEl.tagName === 'TD' || htmlEl.tagName === 'TH') {
                const classList = htmlEl.className || ''
                const row = htmlEl.parentElement as HTMLTableRowElement
                const table = row?.closest('table')
                
                if (table) {
                  // Get all cells in the row
                  const cells = Array.from(row.cells)
                  const cellElement = htmlEl as HTMLTableCellElement
                  const cellIndex = cells.indexOf(cellElement)
                  const isLastColumn = cellIndex === cells.length - 1
                  
                  // Get all rows in the table
                  const rows = Array.from(table.rows)
                  const rowIndex = rows.indexOf(row)
                  const isLastRow = rowIndex === rows.length - 1
                  
                  // Initialize border properties with important flag
                  htmlEl.style.setProperty('border-style', 'solid', 'important')
                  htmlEl.style.setProperty('border-color', '#000000', 'important')
                  
                  // Handle right border - remove from last column to avoid duplicating wrapper div border
                  if (isLastColumn) {
                    htmlEl.style.setProperty('border-right-width', '0', 'important')
                  } else if (classList.includes('border-r-2')) {
                    htmlEl.style.setProperty('border-right-width', '0.5px', 'important')
                  } else {
                    htmlEl.style.setProperty('border-right-width', '0', 'important')
                  }
                  
                  // Handle bottom border - remove from last row to avoid duplicating wrapper div border
                  if (isLastRow) {
                    htmlEl.style.setProperty('border-bottom-width', '0', 'important')
                  } else if (classList.includes('border-b-2')) {
                    htmlEl.style.setProperty('border-bottom-width', '0.5px', 'important')
                  } else if (classList.includes('border-b')) {
                    htmlEl.style.setProperty('border-bottom-width', '0.5px', 'important')
                  } else {
                    htmlEl.style.setProperty('border-bottom-width', '0', 'important')
                  }
                  
                  // Handle left border - only colspan cells need left border (wrapper div handles first column)
                  const colspan = cellElement.colSpan || 1
                  const isColspanCell = colspan > 1
                  // Only colspan cells (like "Others:" and "IF Resigned Staff:") need left border
                  // Regular first column cells don't need it because wrapper div already provides it
                  if (isColspanCell) {
                    htmlEl.style.setProperty('border-left-width', '0.5px', 'important')
                  } else {
                    htmlEl.style.setProperty('border-left-width', '0', 'important')
                  }
                  
                  // Remove top border (not needed for internal cells)
                  htmlEl.style.setProperty('border-top-width', '0', 'important')
                } else {
                  // Fallback: apply minimal borders if table structure not found
                  htmlEl.style.setProperty('border-width', '0.5px', 'important')
                  htmlEl.style.setProperty('border-style', 'solid', 'important')
                  htmlEl.style.setProperty('border-color', '#000000', 'important')
                }
              }
              
              // Reduce font size for title and subtitle
              if (htmlEl.tagName === 'H2') {
                const classList = htmlEl.className || ''
                if (classList.includes('text-sm') || classList.includes('text-base') || htmlEl.textContent?.includes('RETURN OF ASSETS FORM')) {
                  htmlEl.style.fontSize = '0.875rem'
                  htmlEl.style.lineHeight = '1.25rem'
                  htmlEl.style.fontWeight = 'bold'
                }
              }
              if (htmlEl.tagName === 'P') {
                const classList = htmlEl.className || ''
                const textContent = htmlEl.textContent || ''
                if (classList.includes('text-xs') || textContent.includes('DEPARTMENT COPY') || textContent.includes('ADMIN COPY')) {
                  htmlEl.style.fontSize = '0.75rem'
                  htmlEl.style.lineHeight = '1rem'
                  htmlEl.style.fontWeight = '600'
                }
              }
              // Reduce font size for control number
              if (htmlEl.tagName === 'DIV') {
                const classList = htmlEl.className || ''
                const textContent = htmlEl.textContent || ''
                // Check if this is the control number div (has border-b-2 and text-[10px] class or CTRL NO nearby)
                const hasControlNumberClass = classList.includes('text-[10px]')
                const isControlNumber = classList.includes('border-b-2') && 
                                       (hasControlNumberClass ||
                                        htmlEl.previousElementSibling?.textContent?.includes('CTRL NO') ||
                                        htmlEl.parentElement?.textContent?.includes('CTRL NO'))
                if (isControlNumber && textContent.trim().length > 0) {
                  htmlEl.style.setProperty('font-size', '10px', 'important')
                  htmlEl.style.setProperty('line-height', '1.2', 'important')
                }
              }
              
              // Reduce font size for employee details labels and values
              if (htmlEl.tagName === 'P' || htmlEl.tagName === 'DIV' || htmlEl.tagName === 'SPAN') {
                const classList = htmlEl.className || ''
                // Check if this element is inside the employee details card (has border-2 ancestor)
                let isInEmployeeDetailsCard = false
                let currentParent = htmlEl.parentElement
                while (currentParent && currentParent !== document.body) {
                  if (currentParent.classList.contains('border-2')) {
                    // Check if it's the employee details card (has grid-cols-2 child)
                    const hasGrid = currentParent.querySelector('.grid.grid-cols-2')
                    if (hasGrid) {
                      isInEmployeeDetailsCard = true
                      break
                    }
                  }
                  currentParent = currentParent.parentElement
                }
                
                if (classList.includes('text-xs') || isInEmployeeDetailsCard) {
                  // Make employee details card font size smaller
                  if (isInEmployeeDetailsCard) {
                    htmlEl.style.fontSize = '0.65rem'
                    htmlEl.style.lineHeight = '0.9rem'
                  } else if (classList.includes('text-xs')) {
                  htmlEl.style.fontSize = '0.75rem'
                  htmlEl.style.lineHeight = '1rem'
                  }
                }
              }
              // Reduce font size for signature section
              const parentClass = htmlEl.parentElement?.className || ''
              if (parentClass.includes('grid') && parentClass.includes('grid-cols-2') && 
                  (htmlEl.tagName === 'P' || htmlEl.tagName === 'DIV')) {
                htmlEl.style.fontSize = '0.75rem'
                htmlEl.style.lineHeight = '1rem'
              }
              // Make certification text smaller and muted
              if (htmlEl.tagName === 'P') {
                const textContent = htmlEl.textContent || ''
                if (textContent.includes('This certify that assets') || 
                    textContent.includes('complete and in good condition')) {
                  htmlEl.style.fontSize = '10px'
                  htmlEl.style.lineHeight = '1.2'
                  htmlEl.style.color = '#6b7280'
                  htmlEl.style.fontStyle = 'italic'
                }
              }
              
              // Ensure table cells have reduced padding and font size for compact rows
              if (htmlEl.tagName === 'TD' || htmlEl.tagName === 'TH') {
                const classList = htmlEl.className || ''
                // Apply reduced font size for table content
                if (classList.includes('text-xs')) {
                  htmlEl.style.fontSize = '0.75rem'
                  htmlEl.style.lineHeight = '1rem'
                }
                // Check if this is a row with content (has py-0.5) or empty row (has p-2)
                if (classList.includes('py-0.5')) {
                  // Row with content - apply reduced padding
                  htmlEl.style.paddingTop = '2px'
                  htmlEl.style.paddingBottom = '2px'
                  htmlEl.style.paddingLeft = '8px'
                  htmlEl.style.paddingRight = '8px'
                } else if (classList.includes('p-2') && !classList.includes('py-0.5')) {
                  // Empty row - keep original padding
                  htmlEl.style.padding = '8px'
                } else if (classList.includes('py-1')) {
                  // Header row - apply header padding
                  htmlEl.style.paddingTop = '4px'
                  htmlEl.style.paddingBottom = '4px'
                  htmlEl.style.paddingLeft = '8px'
                  htmlEl.style.paddingRight = '8px'
                }
              }
              
              // Ensure checkboxes are visible and properly styled
              if (htmlEl.tagName === 'INPUT' && (htmlEl as HTMLInputElement).type === 'checkbox') {
                const checkbox = htmlEl as HTMLInputElement
                
                // Check both the checked property and the checked attribute
                const isChecked = checkbox.checked || checkbox.hasAttribute('checked') || checkbox.getAttribute('checked') === '' || checkbox.getAttribute('checked') === 'true'
                
                // Force the checked state
                if (isChecked) {
                  checkbox.checked = true
                  checkbox.setAttribute('checked', 'checked')
                } else {
                  checkbox.checked = false
                  checkbox.removeAttribute('checked')
                }
                
                checkbox.style.width = '12px'
                checkbox.style.height = '12px'
                checkbox.style.border = '1.5px solid #000000'
                checkbox.style.borderRadius = '2px'
                checkbox.style.appearance = 'none'
                checkbox.style.setProperty('-webkit-appearance', 'none')
                checkbox.style.setProperty('-moz-appearance', 'none')
                checkbox.style.cursor = 'default'
                checkbox.style.position = 'relative'
                checkbox.style.display = 'inline-block'
                checkbox.style.verticalAlign = 'middle'
                checkbox.style.setProperty('-webkit-print-color-adjust', 'exact')
                checkbox.style.setProperty('print-color-adjust', 'exact')
                
                // Style checked checkboxes with black background and white checkmark
                if (isChecked) {
                  checkbox.style.backgroundColor = '#000000'
                  checkbox.style.borderColor = '#000000'
                  // Use smaller SVG checkmark for 12px checkbox
                  const checkmarkSVG = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path fill="white" stroke="white" stroke-width="1.2" d="M1.5 4 L3.5 6 L6.5 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')
                  checkbox.style.backgroundImage = `url("data:image/svg+xml,${checkmarkSVG}")`
                  checkbox.style.backgroundSize = '8px 8px'
                  checkbox.style.backgroundRepeat = 'no-repeat'
                  checkbox.style.backgroundPosition = 'center'
                } else {
                  checkbox.style.backgroundColor = '#ffffff'
                  checkbox.style.borderColor = '#000000'
                  checkbox.style.backgroundImage = 'none'
                }
              }
            })
            }) // End forEach for targetElements
          }
        }, targetIds)
      }

      // Always use A4 size (210 x 297 mm or 8.27 x 11.69 inches)
      const pdfOptions: Parameters<typeof page.pdf>[0] = {
        format: 'A4', // This ensures 210 x 297 mm
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        preferCSSPageSize: false, // Use the format specified above
        displayHeaderFooter: false,
      }

      // Use print media emulation for better style matching
      await page.emulateMediaType('print')
      
      // Generate PDF
      const pdf = await page.pdf(pdfOptions)

      await browser.close()

      // Return PDF as response
      const filename = targetIds.length > 1 
        ? 'return-of-assets-combined.pdf'
        : 'return-of-assets-it-copy.pdf'
      
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
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

