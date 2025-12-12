import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'

/**
 * Extract company initials from company name
 * Handles:
 * - Multiple words: "Shore Agents" -> "SA"
 * - CamelCase/combined words: "ShoreAgents" -> "SA", "ABCCompany" -> "AC"
 * - Single word: "XYZ" -> "XY"
 * Examples: "Shore Agents" -> "SA", "ShoreAgents" -> "SA", "ABC Company" -> "AC", "XYZ" -> "XY"
 */
function getCompanyInitials(companyName: string | null): string {
  if (!companyName || companyName.trim().length === 0) {
    return 'SA' // Default fallback
  }

  const trimmed = companyName.trim()
  
  // First, try splitting by spaces (multiple words)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  
  if (words.length >= 2) {
    // Multiple words: take first letter of first two words
    const first = words[0].charAt(0).toUpperCase()
    const second = words[1].charAt(0).toUpperCase()
    return `${first}${second}`
  } else if (words.length === 1) {
    // Single word: try to detect camelCase or combined words
    const word = words[0]
    
    // Check for camelCase pattern - handles both "ShoreAgents" and "shoreAgents"
    // Pattern 1: Uppercase letter followed by lowercase, then uppercase (e.g., "ShoreAgents")
    const camelCaseMatch1 = word.match(/^([A-Z][a-z]+)([A-Z][a-z]*)/)
    if (camelCaseMatch1) {
      const firstPart = camelCaseMatch1[1] // "Shore"
      const secondPart = camelCaseMatch1[2] // "Agents"
      const first = firstPart.charAt(0).toUpperCase()
      const second = secondPart.charAt(0).toUpperCase()
      return `${first}${second}`
    }
    
    // Pattern 2: Lowercase followed by uppercase (e.g., "shoreAgents")
    const camelCaseMatch2 = word.match(/^([a-z]+)([A-Z][a-z]*)/)
    if (camelCaseMatch2) {
      const firstPart = camelCaseMatch2[1] // "shore"
      const secondPart = camelCaseMatch2[2] // "Agents"
      const first = firstPart.charAt(0).toUpperCase()
      const second = secondPart.charAt(0).toUpperCase()
      return `${first}${second}`
    }
    
    // Check for all caps with word boundaries (e.g., "ABCCOMPANY" -> "AC")
    if (word === word.toUpperCase() && word.length > 2) {
      // Take first letter and find next significant letter
      const first = word.charAt(0)
      // Find next uppercase letter that's not immediately after
      for (let i = 1; i < word.length; i++) {
        if (word.charAt(i) >= 'A' && word.charAt(i) <= 'Z') {
          return `${first}${word.charAt(i)}`
        }
      }
    }
    
    // No camelCase detected: take first 2 letters
    return trimmed.substring(0, 2).toUpperCase().padEnd(2, 'X')
  }
  
  // Fallback
  return 'SA'
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    // Get company info to extract initials
    const companyInfo = await prisma.companyInfo.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        companyName: true,
      },
    })

    // Get company initials (e.g., "Shore Agents" -> "SA")
    const companySuffix = getCompanyInitials(companyInfo?.companyName || null)

    // Get all item codes that match the pattern INV-XXX-[SUFFIX]
    const items = await prisma.inventoryItem.findMany({
      where: {
        itemCode: {
          startsWith: 'INV-',
        },
        isDeleted: false,
      },
      select: {
        itemCode: true,
      },
      orderBy: {
        itemCode: 'desc',
      },
    })

    // Extract the highest sequential number for this suffix
    let nextNumber = 1
    const pattern = new RegExp(`^INV-(\\d+)-${companySuffix}$`)
    
    for (const item of items) {
      const match = item.itemCode.match(pattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num >= nextNumber) {
          nextNumber = num + 1
        }
      }
    }

    // Format: INV-001-[SUFFIX] (3 digits, zero-padded)
    const nextCode = `INV-${nextNumber.toString().padStart(3, '0')}-${companySuffix}`

    // Check if the generated code already exists (safety check)
    const exists = await prisma.inventoryItem.findUnique({
      where: { itemCode: nextCode },
    })

    if (exists) {
      // If exists, try next number
      nextNumber++
      const fallbackCode = `INV-${nextNumber.toString().padStart(3, '0')}-${companySuffix}`
      return NextResponse.json({ itemCode: fallbackCode })
    }

    return NextResponse.json({ itemCode: nextCode })
  } catch (error) {
    console.error('Error generating item code:', error)
    return NextResponse.json(
      { error: 'Failed to generate item code' },
      { status: 500 }
    )
  }
}

