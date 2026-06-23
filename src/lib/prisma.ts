import { PrismaClient } from '@prisma/client'
import { getServerSession } from "next-auth"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

// Scoped Prisma client utilizing Prisma client extensions.
// It automatically intercepts all queries and scopes them by tenant clientId.
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const modelsWithClientId = [
          'User', 'Project', 'RateCard', 'Approval', 'Dispatch',
          'Notification', 'Activity', 'StatusHistory', 'SystemSetting'
        ]

        if (modelsWithClientId.includes(model)) {
          let session = (global as any).mockSession !== undefined ? (global as any).mockSession : null
          if (!session) {
            try {
              // Dynamic session lookup in request context with dynamic import to break circular dependency
              const { authOptions } = await import("./auth")
              session = await getServerSession(authOptions)
            } catch {
              // Outside request context (e.g. seed, migrations)
            }
          }

          if (session && session.user.role !== 'SUPERADMIN' && session.user.clientId) {
            const clientId = session.user.clientId
            const fieldName = model === 'Project' ? 'tenantClientId' : 'clientId'

            const anyArgs = args as any

            // Scopes writes/creates
            if (operation === 'create') {
              anyArgs.data = anyArgs.data || {}
              anyArgs.data[fieldName] = clientId
            } else if (operation === 'createMany') {
              if (Array.isArray(anyArgs.data)) {
                anyArgs.data = anyArgs.data.map((item: any) => ({
                  ...item,
                  [fieldName]: clientId
                }))
              } else if (anyArgs.data && typeof anyArgs.data === 'object') {
                anyArgs.data[fieldName] = clientId
              }
            } else if (operation === 'upsert') {
              anyArgs.create = anyArgs.create || {}
              anyArgs.update = anyArgs.update || {}
              anyArgs.create[fieldName] = clientId
              anyArgs.update[fieldName] = clientId
            } else {
              // Scopes reads/updates/deletes (which use 'where')
              anyArgs.where = anyArgs.where || {}
              if (anyArgs.where.OR) {
                const originalOr = anyArgs.where.OR
                delete anyArgs.where.OR
                anyArgs.where.AND = [
                  { [fieldName]: clientId },
                  { OR: originalOr }
                ]
              } else {
                anyArgs.where[fieldName] = clientId
              }
            }
          }
        }

        return query(args)
      }
    }
  }
}) as unknown as PrismaClient
