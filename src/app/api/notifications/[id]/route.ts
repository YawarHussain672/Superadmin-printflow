import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"

// DELETE /api/notifications/[id] — delete notification on click (mark as read and delete)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await prisma.notification.deleteMany({
      where: { id, userId: session.user.id },
    })

    // Broadcast real-time delete event
    await pusherServer.trigger(CHANNELS.NOTIFICATIONS, EVENTS.NOTIFICATION_DELETED, {
      userId: session.user.id,
      notificationId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 })
  }
}
