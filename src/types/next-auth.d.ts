import { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: UserRole | "SUPERADMIN"
      clientId?: string | null
      companyName?: string
      companyLogoUrl?: string
    }
  }

  interface User {
    id: string
    name: string
    email: string
    role: UserRole | "SUPERADMIN"
    clientId?: string | null
    companyName?: string
    companyLogoUrl?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    name: string
    email: string
    role: UserRole | "SUPERADMIN"
    clientId?: string | null
    companyName?: string
    companyLogoUrl?: string
  }
}
