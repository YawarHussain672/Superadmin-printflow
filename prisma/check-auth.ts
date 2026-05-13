import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const p = new PrismaClient()

async function main() {
  const user = await p.user.findUnique({ where: { email: "admin@axismaxlife.com" } })
  if (!user) { console.log("USER NOT FOUND"); return }
  console.log("Found:", user.email, "| active:", user.active, "| role:", user.role)
  const match = await bcrypt.compare("Admin@123", user.password)
  console.log("Password 'Admin@123' matches:", match)
  if (!match) {
    // Force reset
    const hash = await bcrypt.hash("Admin@123", 10)
    await p.user.update({ where: { email: "admin@axismaxlife.com" }, data: { password: hash, active: true } })
    console.log("Password forcefully reset to Admin@123")
  }
}

main().catch(console.error).finally(() => p.$disconnect())
