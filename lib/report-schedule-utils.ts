/**
 * Calculate the next run time for a scheduled report based on frequency and schedule
 */
export function calculateNextRunAt(params: {
  frequency: string
  frequencyDay?: number | null
  frequencyMonth?: number | null
  scheduledTime: string
}): Date {
  const { frequency, frequencyDay, frequencyMonth, scheduledTime } = params
  
  const now = new Date()
  const [hours, minutes] = scheduledTime.split(':').map(Number)
  
  const nextRun = new Date()
  
  // Set the time
  nextRun.setHours(hours, minutes, 0, 0)
  
  switch (frequency) {
    case 'daily':
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break
      
    case 'weekly':
      // frequencyDay: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const targetDay = frequencyDay !== null && frequencyDay !== undefined ? frequencyDay : now.getDay()
      const currentDay = now.getDay()
      let daysUntilTarget = (targetDay - currentDay + 7) % 7
      
      // If it's the target day but time has passed, schedule for next week
      if (daysUntilTarget === 0 && nextRun <= now) {
        daysUntilTarget = 7
      }
      
      nextRun.setDate(nextRun.getDate() + daysUntilTarget)
      break
      
    case 'monthly':
      // frequencyDay: 1-31 (day of month)
      const targetDayOfMonth = frequencyDay !== null && frequencyDay !== undefined ? frequencyDay : now.getDate()
      const currentDayOfMonth = now.getDate()
      
      if (targetDayOfMonth < currentDayOfMonth) {
        // Target day has passed this month, schedule for next month
        nextRun.setMonth(nextRun.getMonth() + 1)
        nextRun.setDate(targetDayOfMonth)
      } else if (targetDayOfMonth === currentDayOfMonth) {
        // Same day - check if time has passed
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1)
          nextRun.setDate(targetDayOfMonth)
        } else {
          nextRun.setDate(targetDayOfMonth)
        }
      } else {
        // Target day is later this month
        nextRun.setDate(targetDayOfMonth)
      }
      break
      
    case 'yearly':
      // frequencyMonth: 1-12 (January-December)
      // frequencyDay: 1-31 (day of month)
      const targetMonth = frequencyMonth !== null && frequencyMonth !== undefined ? frequencyMonth - 1 : now.getMonth() // 0-indexed
      const targetDayOfYear = frequencyDay !== null && frequencyDay !== undefined ? frequencyDay : now.getDate()
      const currentMonth = now.getMonth()
      const currentDayOfYear = now.getDate()
      
      if (targetMonth < currentMonth || (targetMonth === currentMonth && targetDayOfYear < currentDayOfYear) || (targetMonth === currentMonth && targetDayOfYear === currentDayOfYear && nextRun <= now)) {
        // Target date has passed this year, schedule for next year
        nextRun.setFullYear(nextRun.getFullYear() + 1)
        nextRun.setMonth(targetMonth)
        nextRun.setDate(targetDayOfYear)
      } else {
        nextRun.setMonth(targetMonth)
        nextRun.setDate(targetDayOfYear)
      }
      break
      
    default:
      // Default to daily if frequency is not recognized
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
  }
  
  return nextRun
}

/**
 * Format frequency description for display
 */
export function formatFrequencyDescription(params: {
  frequency: string
  frequencyDay?: number | null
  frequencyMonth?: number | null
  scheduledTime: string
}): string {
  const { frequency, frequencyDay, frequencyMonth, scheduledTime } = params
  
  const timeStr = formatTime(scheduledTime)
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  
  switch (frequency) {
    case 'daily':
      return `Daily at ${timeStr}`
      
    case 'weekly':
      const dayName = frequencyDay !== null && frequencyDay !== undefined ? daysOfWeek[frequencyDay] : 'selected day'
      return `Every ${dayName} at ${timeStr}`
      
    case 'monthly':
      const dayOfMonth = frequencyDay !== null && frequencyDay !== undefined ? frequencyDay : 1
      const suffix = getDaySuffix(dayOfMonth)
      return `Every month on the ${dayOfMonth}${suffix} at ${timeStr}`
      
    case 'yearly':
      const monthName = frequencyMonth !== null && frequencyMonth !== undefined ? months[frequencyMonth - 1] : 'selected month'
      const day = frequencyDay !== null && frequencyDay !== undefined ? frequencyDay : 1
      const daySuffix = getDaySuffix(day)
      return `Every year on ${monthName} ${day}${daySuffix} at ${timeStr}`
      
    default:
      return `At ${timeStr}`
  }
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th'
  }
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

