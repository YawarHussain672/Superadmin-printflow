import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("Auth Debug: Missing email or password");
          throw new Error("Invalid credentials")
        }

        try {
          const emailLower = credentials.email.toLowerCase()
          console.log("Auth Debug: Attempting login for", emailLower);

          // 1. Check SuperAdmin from Environment variables first
          const envSuperadminEmail = process.env.SUPERADMIN_EMAIL
          const envSuperadminPassword = process.env.SUPERADMIN_PASSWORD

          if (
            envSuperadminEmail &&
            envSuperadminPassword &&
            emailLower === envSuperadminEmail.toLowerCase() &&
            credentials.password === envSuperadminPassword
          ) {
            console.log("Auth Debug: SuperAdmin logged in via environment variables");
            return {
              id: "env-superadmin",
              email: envSuperadminEmail,
              name: "SuperAdmin User",
              role: "SUPERADMIN",
              clientId: null,
              companyName: "Rishiraj Media",
              companyLogoUrl: "/rm-white-logo3.svg",
            }
          }

          // 2. Check SuperAdmin table next (database fallback)
          const superAdmin = await prisma.superAdmin.findUnique({
            where: { email: emailLower },
          })

          if (superAdmin) {
            const isPasswordValid = await bcrypt.compare(
              credentials.password,
              superAdmin.passwordHash
            )

            console.log("Auth Debug: SuperAdmin database password valid:", isPasswordValid);

            if (!isPasswordValid) {
              return null
            }

            return {
              id: superAdmin.id,
              email: superAdmin.email,
              name: superAdmin.name,
              role: "SUPERADMIN",
              clientId: null,
              companyName: "Rishiraj Media",
              companyLogoUrl: "/rm-white-logo3.svg",
            }
          }

          // 2. Check User table (existing logic)
          const user = await prisma.user.findUnique({
            where: { email: emailLower },
          })

          if (!user) {
            console.log("Auth Debug: User not found");
            return null
          }

          if (!user.password) {
            console.log("Auth Debug: User has no password set");
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          console.log("Auth Debug: User password valid:", isPasswordValid);

          if (!isPasswordValid) {
            return null
          }

          if (!user.active) {
            console.log("Auth Debug: User is inactive");
            return null
          }

          // Check if user has a client and if that client is active
          let companyName = "Axis Max Life"
          let companyLogoUrl = "https://play-lh.googleusercontent.com/Vn9VseeV197UW8_kkGzMJY0dsORX93S2wY3j_YHeotP_GaRZ-9rf9BSeCbSjNy83fzA"

          if (user.clientId) {
            const client = await prisma.client.findUnique({
              where: { id: user.clientId },
            })
            if (!client) {
              console.log("Auth Debug: Client record not found for user's clientId");
              return null
            }
            if (!client.isActive) {
              console.log("Auth Debug: Client account is deactivated");
              throw new Error("Client account is deactivated. Please contact support.")
            }
            companyName = client.companyName
            if (client.companyLogoUrl) {
              companyLogoUrl = client.companyLogoUrl
            }
          }

          console.log("Auth Debug: Login successful for", user.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clientId: user.clientId,
            companyName,
            companyLogoUrl,
          }
        } catch (error) {
          console.error("Auth error:", error)
          if (error instanceof Error && error.message.includes("deactivated")) {
            throw error
          }
          return null
        }
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.name = token.name
        session.user.email = token.email
        session.user.role = token.role
        session.user.clientId = token.clientId || null
        session.user.companyName = token.companyName
        session.user.companyLogoUrl = token.companyLogoUrl
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.role = user.role
        token.clientId = user.clientId || null
        token.companyName = user.companyName
        token.companyLogoUrl = user.companyLogoUrl
      }
      return token
    },
  },
}
