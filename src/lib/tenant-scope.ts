import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export function withTenantScope(handler: (req: NextRequest, ctx: any) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: any) => {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { role } = session.user

      // SuperAdmin is read-only on standard tenant mutation endpoints
      if (role === "SUPERADMIN") {
        const method = req.method.toUpperCase()
        if (["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
          return NextResponse.json(
            { error: "Forbidden: SuperAdmin has read-only access to tenant endpoints." },
            { status: 403 }
          )
        }
      }

      // Run the handler directly
      return await handler(req, ctx)
    } catch (error) {
      console.error("Scoped API error:", error)
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
  }
}

