import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Valid roles including newly added CLIENT
type UserRole = "ADMIN" | "POC" | "CLIENT"

// GET /api/team - List all team members
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        location: true,
        branch: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Team fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 })
  }
}

// POST /api/team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, email, phone, role, password, location, branch } = await request.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 409 })

    // Validate role is one of the allowed values
    const validRoles: UserRole[] = ["ADMIN", "POC", "CLIENT"]
    const userRole = validRoles.includes(role as UserRole) ? role : "POC"

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role: userRole,
        password: hashed,
        active: true,
        location,
        branch
      },
    })

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      location: user.location,
      branch: user.branch,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }

    return NextResponse.json(safeUser, { status: 201 })
  } catch (error) {
    console.error("Team creation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create team member"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
