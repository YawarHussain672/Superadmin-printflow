import { PrismaClient, UserRole, ProjectStatus, FileType, ApprovalStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding minimal demo data...")

  // Clean existing data
  await prisma.notification.deleteMany()
  await prisma.fileUpload.deleteMany()
  await prisma.collateral.deleteMany()
  await prisma.statusHistory.deleteMany()
  await prisma.dispatch.deleteMany()
  await prisma.approval.deleteMany()
  await prisma.project.deleteMany()
  await prisma.rateCard.deleteMany()
  await prisma.user.deleteMany()

  console.log("Cleared existing data")

  // Create Admin
  const adminPassword = await bcrypt.hash("Admin@123", 10)
  const admin = await prisma.user.create({
    data: {
      email: "admin@axismaxlife.com",
      name: "Admin User",
      password: adminPassword,
      role: UserRole.ADMIN,
      active: true,
      location: "Delhi",
      branch: "Head Office",
      phone: "+91-11-12345678",
    },
  })
  console.log("Admin created:", admin.email)

  // Create POCs with the exact emails requested
  const pocPassword = await bcrypt.hash("Poc@123", 10)

  const pocData = [
    { email: "harsh.gupta@axismaxlife.com", name: "Harsh Gupta", location: "Delhi", branch: "North" },
    { email: "pragyata.sharma@axismaxlife.com", name: "Pragyata Sharma", location: "Mumbai", branch: "West" },
    { email: "balaji.kumar@axismaxlife.com", name: "Balaji Kumar", location: "Chennai", branch: "South" },
    { email: "shyam.gupta@axismaxlife.com", name: "Shyam Gupta", location: "Bangalore", branch: "South" },
  ]

  const pocs = []
  for (const poc of pocData) {
    const created = await prisma.user.create({
      data: {
        email: poc.email,
        name: poc.name,
        password: pocPassword,
        role: UserRole.POC,
        active: true,
        location: poc.location,
        branch: poc.branch,
        phone: "+91-9876543210",
      },
    })
    pocs.push(created)
    console.log("POC created:", created.email)
  }

  // Create Rate Cards with proper structure
  const rateCards = [
    { itemName: "Flier", specification: "A4 front/back, 4 + 4 Color Printing, 90 GSM sinar mass", volumeSlabs: [{ slab: "1000", price: 4.95 }, { slab: "5000", price: 1.92 }] },
    { itemName: "Poster", specification: "19 by 29 inches, 170 GSM, Art Paper", volumeSlabs: [{ slab: "100", price: 75.0 }, { slab: "1000", price: 19.35 }] },
    { itemName: "Standee", specification: "3 ft by 6 ft, Rollup, Star Flex", volumeSlabs: [{ slab: "1-10", price: 1100.0 }, { slab: "11-50", price: 975.0 }] },
    { itemName: "Dangler", specification: "Size: A4, 300 GSM, Front Back printing", volumeSlabs: [{ slab: "1000", price: 9.7 }, { slab: "5000", price: 4.95 }] },
    { itemName: "Brochure", specification: "A4 Closed, 16 Pages+ Cover", volumeSlabs: [{ slab: "1000", price: 41.71 }] },
  ]

  await Promise.all(rateCards.map((rc) => prisma.rateCard.create({ data: rc })))
  console.log("Rate cards created:", rateCards.length)

  // Create one sample project for each POC
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const projectTemplates = [
    {
      name: "Delhi Branch Campaign",
      location: "Delhi",
      branch: "North",
      state: "Delhi",
      status: ProjectStatus.REQUESTED,
      pocIndex: 0,
      collaterals: [{ itemName: "Flier", quantity: 1000, unitPrice: 4.95, totalPrice: 4950 }],
      totalCost: 5841,
      createdAt: yesterday,
    },
    {
      name: "Mumbai Marketing Materials",
      location: "Mumbai",
      branch: "West",
      state: "Maharashtra",
      status: ProjectStatus.APPROVED,
      pocIndex: 1,
      collaterals: [{ itemName: "Poster", quantity: 200, unitPrice: 24.75, totalPrice: 4950 }],
      totalCost: 5841,
      createdAt: weekAgo,
    },
    {
      name: "Chennai Branch Opening",
      location: "Chennai",
      branch: "South",
      state: "Tamil Nadu",
      status: ProjectStatus.PRINTING,
      pocIndex: 2,
      collaterals: [{ itemName: "Standee", quantity: 15, unitPrice: 975, totalPrice: 14625 }],
      totalCost: 17257.50,
      createdAt: weekAgo,
    },
    {
      name: "Bangalore Product Launch",
      location: "Bangalore",
      branch: "South",
      state: "Karnataka",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{ itemName: "Dangler", quantity: 2000, unitPrice: 9.70, totalPrice: 19400 }],
      totalCost: 22892,
      createdAt: weekAgo,
    },
  ]

  for (let i = 0; i < projectTemplates.length; i++) {
    const proj = projectTemplates[i]
    const piNumber = (2000 + i).toString()

    const project = await prisma.project.create({
      data: {
        projectId: `PROJ-2024-${String(i + 1).padStart(3, '0')}`,
        piNumber: piNumber,
        name: proj.name,
        location: proj.location,
        branch: proj.branch,
        state: proj.state,
        status: proj.status,
        totalCost: proj.totalCost,
        deliveryDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000),
        instructions: "Sample project for demo purposes",
        pocId: pocs[proj.pocIndex].id,
        createdAt: proj.createdAt,
        updatedAt: proj.createdAt,
        collaterals: {
          create: proj.collaterals,
        },
        statusHistory: {
          create: [
            { status: ProjectStatus.REQUESTED, note: "Project requested" },
            ...(proj.status !== ProjectStatus.REQUESTED ? [{ status: ProjectStatus.APPROVED, note: "Approved by admin" }] : []),
            ...(proj.status === ProjectStatus.PRINTING || proj.status === ProjectStatus.DELIVERED ? [{ status: ProjectStatus.PRINTING, note: "Printing started" }] : []),
            ...(proj.status === ProjectStatus.DELIVERED ? [{ status: ProjectStatus.DISPATCHED, note: "Dispatched" }] : []),
            ...(proj.status === ProjectStatus.DELIVERED ? [{ status: ProjectStatus.DELIVERED, note: "Delivered" }] : []),
          ],
        },
      },
    })
    console.log("Project created:", project.projectId, "-", project.name)
  }

  console.log("\n✅ Seed completed successfully!")
  console.log("\nLogin credentials:")
  console.log("Admin: admin@axismaxlife.com / Admin@123")
  console.log("POCs: [email]@axismaxlife.com / Poc@123")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
