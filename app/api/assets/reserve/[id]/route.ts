import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

// DELETE - Delete a reservation record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canReserve')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    
    // Check if reservation record exists
    const reservation = await prisma.assetsReserve.findUnique({
      where: { id },
    })

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation record not found' },
        { status: 404 }
      )
    }

    // Delete the reservation record
    await prisma.assetsReserve.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reservation record:', error)
    return NextResponse.json(
      { error: 'Failed to delete reservation record' },
      { status: 500 }
    )
  }
}

