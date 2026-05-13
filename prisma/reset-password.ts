import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@456", 10)
  const pocPassword = await bcrypt.hash("Poc@123", 10)

  const admin = await prisma.user.upsert({
    where: { email: "admin@axismaxlife.com" },
    update: { password: adminPassword, active: true },
    create: {
      email: "admin@axismaxlife.com",
      name: "Admin User",
      password: adminPassword,
      role: "ADMIN",
      active: true,
    },
  })
  console.log("✅ Admin password reset:", admin.email)

  // Reset all POC passwords too
  const pocs = await prisma.user.findMany({ where: { role: "POC" } })
  for (const poc of pocs) {
    await prisma.user.update({ where: { id: poc.id }, data: { password: pocPassword, active: true } })
    console.log("✅ POC password reset:", poc.email)
  }

  console.log("\nLogin credentials:")
  console.log("Admin: admin@axismaxlife.com / Admin@123")
  console.log("POC:   [email] / Poc@123")
}

main().catch(console.error).finally(() => prisma.$disconnect())
