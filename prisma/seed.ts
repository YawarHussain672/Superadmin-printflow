import { PrismaClient, UserRole, ProjectStatus, ApprovalStatus, FileType } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding comprehensive demo data...")

  // Clean existing data
  await prisma.activity.deleteMany()
  await prisma.approval.deleteMany()
  await prisma.dispatch.deleteMany()
  await prisma.fileUpload.deleteMany()
  await prisma.statusHistory.deleteMany()
  await prisma.collateral.deleteMany()
  await prisma.project.deleteMany()
  await prisma.rateCard.deleteMany()
  await prisma.user.deleteMany()

  console.log("Cleared existing data")

  // Create admin user
  const adminPassword = await bcrypt.hash("Admin@123", 10)
  const admin = await prisma.user.create({
    data: {
      email: "admin@axismaxlife.com",
      name: "Admin User",
      password: adminPassword,
      role: UserRole.ADMIN,
      phone: "+91 98765 43210",
      location: "Mumbai",
      branch: "Head Office",
      active: true,
    },
  })
  console.log("Admin created:", admin.email)

  // Create POC users - exactly 4 POCs as per business logic document
  const pocData = [
    { email: "harsh.gupta@axismaxlife.com", name: "Harsh Gupta", phone: "+91 98765 43211", location: "Delhi", branch: "Connaught Place Branch" },
    { email: "pragyata.sharma@axismaxlife.com", name: "Pragyata Sharma", phone: "+91 98765 43212", location: "Mumbai", branch: "Andheri Branch" },
    { email: "balaji.kumar@axismaxlife.com", name: "Balaji Kumar", phone: "+91 98765 43213", location: "Chennai", branch: "Anna Nagar Branch" },
    { email: "shyam.gupta@axismaxlife.com", name: "Shyam Gupta", phone: "+91 98765 43214", location: "Kolkata", branch: "Park Street Branch" },
  ]

  const pocPassword = await bcrypt.hash("Poc@123", 10)
  const pocs = await Promise.all(
    pocData.map((poc) =>
      prisma.user.create({
        data: {
          email: poc.email,
          name: poc.name,
          password: pocPassword,
          role: UserRole.POC,
          phone: poc.phone,
          location: poc.location,
          branch: poc.branch,
          active: true,
        },
      })
    )
  )
  console.log("POCs created:", pocs.length)

  // Create Rate Card items
  const rateCardData = [
    { itemName: "Flier", specification: "A4 front/back, 4 + 4 Color Printing, 90 GSM sinar mass", volumeSlabs: [{ slab: "1000", price: 4.95 }, { slab: "5000", price: 1.92 }] },
    { itemName: "Poster", specification: "19 by 29 inches, 170 GSM, Art Paper", volumeSlabs: [{ slab: "100", price: 75.0 }, { slab: "1000", price: 19.35 }] },
    { itemName: "Standee", specification: "3 ft by 6 ft, Rollup, Star Flex", volumeSlabs: [{ slab: "1-10", price: 1100.0 }, { slab: "11-50", price: 975.0 }] },
    { itemName: "Dangler", specification: "Size: A4, 300 GSM, Front Back printing", volumeSlabs: [{ slab: "1000", price: 9.7 }, { slab: "5000", price: 4.95 }] },
    { itemName: "Brochure", specification: "A4 Closed, 16 Pages+ Cover", volumeSlabs: [{ slab: "1000", price: 41.71 }] },
  ]

  await Promise.all(
    rateCardData.map((item) =>
      prisma.rateCard.create({ data: item })
    )
  )
  console.log("Rate cards created")

  // Create projects with all statuses
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const projectTemplates = [
    // REQUESTED - Just created (Harsh Gupta - Delhi)
    {
      name: "Marketing Collateral - Q1 Campaign",
      location: "Delhi",
      branch: "Connaught Place Branch",
      state: "Delhi",
      status: ProjectStatus.REQUESTED,
      pocIndex: 0,
      collaterals: [{ itemName: "Flier", quantity: 5000, unitPrice: 1.92, totalPrice: 9600 }, { itemName: "Poster", quantity: 500, unitPrice: 19.35, totalPrice: 9675 }],
      totalCost: 19275,
      createdAt: weekAgo,
      statusHistory: [
        { status: ProjectStatus.REQUESTED, note: "Project requested by POC" },
      ],
    },
    // APPROVED - Approved but not yet printing (Pragyata Sharma - Mumbai)
    {
      name: "Annual Report Print Job",
      location: "Mumbai",
      branch: "Bandra Branch",
      state: "Maharashtra",
      status: ProjectStatus.APPROVED,
      pocIndex: 1,
      collaterals: [{ itemName: "Brochure", quantity: 1000, unitPrice: 41.71, totalPrice: 41710 }],
      totalCost: 41710,
      createdAt: twoWeeksAgo,
      statusHistory: [
        { status: ProjectStatus.REQUESTED, note: "Project requested" },
        { status: ProjectStatus.APPROVED, note: "Approved by admin" },
      ],
      files: [{ type: "PO", filename: "PO-2024-001.pdf", url: "https://example.com/po1.pdf" }],
    },
    // PRINTING - Currently in production (Balaji Kumar - Chennai)
    {
      name: "Product Launch Materials",
      location: "Chennai",
      branch: "T Nagar Branch",
      state: "Tamil Nadu",
      status: ProjectStatus.PRINTING,
      pocIndex: 2,
      collaterals: [{ itemName: "Standee", quantity: 25, unitPrice: 975, totalPrice: 24375 }, { itemName: "Dangler", quantity: 3000, unitPrice: 4.95, totalPrice: 14850 }],
      totalCost: 39225,
      createdAt: twoWeeksAgo,
      statusHistory: [
        { status: ProjectStatus.REQUESTED, note: "Project requested" },
        { status: ProjectStatus.APPROVED, note: "Approved by admin" },
        { status: ProjectStatus.PRINTING, note: "Sent to printing vendor" },
      ],
      files: [{ type: "PO", filename: "PO-2024-002.pdf", url: "https://example.com/po2.pdf" }],
    },
    // DISPATCHED - Shipped but not delivered (Balaji Kumar - Chennai)
    {
      name: "Branch Opening Materials - Chennai",
      location: "Chennai",
      branch: "T Nagar Branch",
      state: "Tamil Nadu",
      status: ProjectStatus.DISPATCHED,
      pocIndex: 2,
      collaterals: [{ itemName: "Flier", quantity: 10000, unitPrice: 1.58, totalPrice: 15800 }, { itemName: "Poster", quantity: 200, unitPrice: 24.75, totalPrice: 4950 }],
      totalCost: 20750,
      createdAt: monthAgo,
      statusHistory: [
        { status: ProjectStatus.REQUESTED, note: "Project requested" },
        { status: ProjectStatus.APPROVED, note: "Approved" },
        { status: ProjectStatus.PRINTING, note: "In printing" },
        { status: ProjectStatus.DISPATCHED, note: "Dispatched via Blue Dart" },
      ],
      files: [
        { type: "PO", filename: "PO-2024-003.pdf", url: "https://example.com/po3.pdf" },
        { type: "CHALLAN", filename: "CHALLAN-2024-003.pdf", url: "https://example.com/challan3.pdf" },
      ],
      dispatch: { courier: "Blue Dart", trackingId: "BD123456789", dispatchDate: yesterday, expectedDelivery: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000) },
    },
    // DELIVERED - Complete with all files (Harsh Gupta - Gurgaon)
    {
      name: "Marketing Collateral - DLF Phase 1",
      location: "Gurgaon",
      branch: "DLF Phase 1 Branch",
      state: "Haryana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 0,
      collaterals: [{ itemName: "Poster", quantity: 100, unitPrice: 75, totalPrice: 7500 }, { itemName: "Standee", quantity: 10, unitPrice: 1100, totalPrice: 11000 }],
      totalCost: 18500,
      createdAt: monthAgo,
      statusHistory: [
        { status: ProjectStatus.REQUESTED, note: "Project requested" },
        { status: ProjectStatus.APPROVED, note: "Approved" },
        { status: ProjectStatus.PRINTING, note: "In printing" },
        { status: ProjectStatus.DISPATCHED, note: "Dispatched" },
        { status: ProjectStatus.DELIVERED, note: "Delivered and accepted" },
      ],
      files: [
        { type: "PO", filename: "PO-2024-004.pdf", url: "https://example.com/po4.pdf" },
        { type: "CHALLAN", filename: "CHALLAN-2024-004.pdf", url: "https://example.com/challan4.pdf" },
        { type: "INVOICE", filename: "INV-2024-004.pdf", url: "https://example.com/inv4.pdf" },
        { type: "POD", filename: "POD-2024-004.pdf", url: "https://example.com/pod4.pdf" },
      ],
      dispatch: { courier: "Blue Dart", trackingId: "BD987654321", dispatchDate: yesterday, expectedDelivery: today, actualDelivery: today },
      leads: { leadsGenerated: 150, leadsConverted: 45 },
    },
    // Another DELIVERED (Balaji Kumar - Chennai)
    {
      name: "NRI Marketing Campaign",
      location: "Chennai",
      branch: "Adyar Branch",
      state: "Tamil Nadu",
      status: ProjectStatus.DELIVERED,
      pocIndex: 2,
      collaterals: [{ itemName: "Flier", quantity: 2500, unitPrice: 3.0, totalPrice: 7500 }, { itemName: "Dangler", quantity: 1000, unitPrice: 9.7, totalPrice: 9700 }],
      totalCost: 17200,
      createdAt: twoWeeksAgo,
      statusHistory: [
        { status: ProjectStatus.REQUESTED, note: "Project requested" },
        { status: ProjectStatus.APPROVED, note: "Approved" },
        { status: ProjectStatus.PRINTING, note: "In printing" },
        { status: ProjectStatus.DISPATCHED, note: "Dispatched" },
        { status: ProjectStatus.DELIVERED, note: "Delivered" },
      ],
      files: [
        { type: "PO", filename: "PO-2024-005.pdf", url: "https://example.com/po5.pdf" },
        { type: "CHALLAN", filename: "CHALLAN-2024-005.pdf", url: "https://example.com/challan5.pdf" },
        { type: "INVOICE", filename: "INV-2024-005.pdf", url: "https://example.com/inv5.pdf" },
        { type: "POD", filename: "POD-2024-005.pdf", url: "https://example.com/pod5.pdf" },
      ],
      dispatch: { courier: "DHL", trackingId: "DHL555666777", dispatchDate: yesterday, expectedDelivery: today, actualDelivery: today },
      leads: { leadsGenerated: 80, leadsConverted: 22 },
    },
    // CANCELLED (Shyam Gupta - Kolkata)
    {
      name: "Holiday Special - Cancelled",
      location: "Kolkata",
      branch: "Salt Lake Branch",
      state: "West Bengal",
      status: ProjectStatus.CANCELLED,
      pocIndex: 3,
      collaterals: [{ itemName: "Poster", quantity: 50, unitPrice: 75, totalPrice: 3750 }],
      totalCost: 3750,
      createdAt: monthAgo,
      statusHistory: [
        { status: ProjectStatus.REQUESTED, note: "Project requested" },
        { status: ProjectStatus.APPROVED, note: "Approved" },
        { status: ProjectStatus.CANCELLED, note: "Cancelled due to budget constraints" },
      ],
    },
  ]

  for (let i = 0; i < projectTemplates.length; i++) {
    const proj = projectTemplates[i]
    const year = today.getFullYear()
    const projectId = `PRJ-${year}-${100 + i}`
    const piNumber = (2000 + i).toString()

    const project = await prisma.project.create({
      data: {
        projectId,
        name: proj.name,
        piNumber,
        location: proj.location,
        branch: proj.branch,
        state: proj.state,
        deliveryDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: proj.status,
        totalCost: proj.totalCost,
        pocId: pocs[proj.pocIndex].id,
        createdAt: proj.createdAt,
        collaterals: {
          create: proj.collaterals,
        },
        statusHistory: {
          create: proj.statusHistory,
        },
      },
    })

    // Create files if any
    if (proj.files) {
      for (const file of proj.files) {
        await prisma.fileUpload.create({
          data: {
            projectId: project.id,
            filename: file.filename,
            url: file.url,
            type: file.type as FileType,
            size: 1024 * 1024,
            uploadedById: admin.id,
          },
        })
      }
    }

    // Create dispatch if any
    if (proj.dispatch) {
      await prisma.dispatch.create({
        data: {
          projectId: project.id,
          courier: proj.dispatch.courier,
          trackingId: proj.dispatch.trackingId,
          dispatchDate: proj.dispatch.dispatchDate,
          expectedDelivery: proj.dispatch.expectedDelivery,
          actualDelivery: proj.dispatch.actualDelivery,
        },
      })
    }

    // Add leads tracking data if any
    if (proj.leads) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          leadsGenerated: proj.leads.leadsGenerated,
          leadsConverted: proj.leads.leadsConverted,
        },
      })
    }

    // Add POD file URL to dispatch if dispatch exists
    if (proj.dispatch) {
      const podFile = proj.files?.find(f => f.type === "POD")
      if (podFile) {
        await prisma.dispatch.update({
          where: { projectId: project.id },
          data: { podUrl: podFile.url },
        })
      }
    }

    // Create approval for PENDING projects
    if (proj.status === ProjectStatus.REQUESTED) {
      await prisma.approval.create({
        data: {
          projectId: project.id,
          requestedById: pocs[proj.pocIndex].id,
          status: ApprovalStatus.PENDING,
          reminderCount: 0,
        },
      })
    }

    console.log(`Created project: ${proj.name} (${proj.status})`)
  }

  console.log("\n========================================")
  console.log("SEED COMPLETED SUCCESSFULLY!")
  console.log("========================================")
  console.log("\nLogin Credentials:")
  console.log("Admin:    admin@axismaxlife.com / Admin@123")
  console.log("POCs:     [name]@axismaxlife.com / Poc@123")
  console.log("\nDemo Data Created:")
  console.log("- 1 Admin + 4 POCs with locations/branches")
  console.log("- 5 Rate Card items")
  console.log("- 7 Projects (all statuses: REQUESTED, APPROVED, PRINTING, DISPATCHED, DELIVERED, CANCELLED)")
  console.log("- Status history for timeline view")
  console.log("- File uploads (PO, Challan, Invoice, POD)")
  console.log("- Dispatches with tracking")
  console.log("- Lead tracking with ROI data")
  console.log("========================================")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
