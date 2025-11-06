// Helper function to parse dates from various formats
export const parseDate = (dateString: string | null | undefined | number): Date | null => {
  if (dateString === null || dateString === undefined) {
    return null
  }
  
  // Handle Excel serial numbers (numbers)
  if (typeof dateString === 'number') {
    // Excel date conversion using pure mathematical approach
    const excelSerialNumber = dateString
    
    // Excel's date system starts from 1900-01-01, but treats 1900 as a leap year
    // This is the most accurate conversion method
    
    // Excel serial number 1 = January 1, 1900
    // But Excel incorrectly treats 1900 as a leap year, so we need to adjust
    
    let daysSince1900 = excelSerialNumber - 1 // Excel starts counting from 1
    
    // Excel's leap year bug: it treats 1900 as a leap year (it's not)
    // So for dates after Feb 28, 1900, we need to subtract 1 day
    if (daysSince1900 > 59) {
      daysSince1900 = daysSince1900 - 1
    }
    
    // Calculate the date components manually
    const year1900 = new Date(1900, 0, 1) // January 1, 1900
    const targetTime = year1900.getTime() + daysSince1900 * 24 * 60 * 60 * 1000
    const targetDate = new Date(targetTime)
    
    // Create the final date at noon to avoid timezone issues
    const result = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 12, 0, 0)
    
    return result
  }
  
  if (typeof dateString !== 'string') {
    return null
  }
  
  // Trim whitespace
  const trimmed = dateString.trim()
  if (!trimmed) {
    return null
  }
  
  // Handle MM/DD/YYYY format
  const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyyMatch) {
    const [, month, day, year] = mmddyyyyMatch
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date
  }
  
  // Handle YYYY-MM-DD format (date input format - must be handled carefully to avoid timezone issues)
  const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch
    // Create date at noon UTC to avoid timezone shifts when storing as Date type
    // This ensures the date stays the same regardless of server timezone
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0))
    return date
  }
  
  // Handle DD/MM/YYYY format
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date
  }
  
  // Try default Date constructor as fallback
  const parsedDate = new Date(trimmed)
  const isValid = !isNaN(parsedDate.getTime())
  
  return isValid ? parsedDate : null
}
