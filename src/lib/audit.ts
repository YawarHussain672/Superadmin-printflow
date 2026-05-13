import { prisma } from "./prisma"
import { Prisma } from "@prisma/client"

export async function logActivity(data: {
  userId: string
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
}) {
  try {
    await prisma.activity.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        details: data.details as Prisma.InputJsonValue,
      },
    })
  } catch {
    // Silent fail - audit log is not critical
  }
}
