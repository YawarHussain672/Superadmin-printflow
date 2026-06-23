import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const path = req.nextUrl.pathname

  // 1. Exclude public static/media assets, auth endpoints, forgot-password, reset-password
  const isPublicPath =
    path.startsWith("/api/auth") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/_next") ||
    path.includes(".")

  if (isPublicPath) {
    return NextResponse.next()
  }

  // 2. SuperAdmin mutation restrictions on all standard tenant API endpoints
  if (path.startsWith("/api/")) {
    const method = req.method.toUpperCase()
    const isMutation = ["POST", "PATCH", "DELETE", "PUT"].includes(method)

    if (isMutation && token && token.role === "SUPERADMIN") {
      // Allow SuperAdmins to create/manage clients/admins, or trigger cron actions
      const isSuperAdminApi = path.startsWith("/api/superadmin/") || path.startsWith("/api/cron/")
      if (!isSuperAdminApi) {
        return new NextResponse(
          JSON.stringify({ error: "Forbidden: SuperAdmins are read-only on tenant records." }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" }
          }
        )
      }
    }
    return NextResponse.next()
  }

  // 3. Handle login path
  if (path === "/login") {
    if (token) {
      if (token.role === "SUPERADMIN") {
        return NextResponse.redirect(new URL("/superadmin/dashboard", req.url))
      } else {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
    }
    return NextResponse.next()
  }

  // 4. Protect routes requiring authentication
  if (!token) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(path)}`, req.url))
  }

  // 5. Route guard for /superadmin/* (SUPERADMIN only)
  if (path.startsWith("/superadmin")) {
    if (token.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return NextResponse.next()
  }

  // 6. Route guard for all other pages (ADMIN, POC, CLIENT only).
  // Redirect SuperAdmins to /superadmin/dashboard
  if (token.role === "SUPERADMIN") {
    return NextResponse.redirect(new URL("/superadmin/dashboard", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api/auth|api/upload|forgot-password|reset-password|_next/static|_next/image|favicon.ico).*)"],
}
