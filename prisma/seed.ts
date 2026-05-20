import { PrismaClient, UserRole, ProjectStatus, ApprovalStatus, FileType } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding initial project data...")

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
    { email: "lokranjan.mahtab@axismaxlife.com", name: "Lokranjan Mahtab", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
    { email: "varun.khanor@axismaxlife.com", name: "Varun Khanor", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
    { email: "preetam.singh@axismaxlife.com", name: "Preetam Singh", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
    { email: "harsh.gupta@axismaxlife.com", name: "Harsh Gupta", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
    { email: "yashika.nagpal@axismaxlife.com", name: "Yashika Nagpal", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
    { email: "rocky.rayat@axismaxlife.com", name: "Rocky Rayat", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
    { email: "jyotika.sonal@axismaxlife.com", name: "Jyotika Sonal", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
    { email: "pragyata.ranjan@axismaxlife.com", name: "Pragyata Ranjan", phone: "+91 99999 99999", location: "Delhi", branch: "Head Office" },
  ]

  const pocPassword = await bcrypt.hash("Poc@123", 10)
  const pocs = []
  for (const poc of pocData) {
    const createdPoc = await prisma.user.create({
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
    pocs.push(createdPoc)
  }
  console.log("POCs created:", pocs.length)

  // Create Rate Card items
  const rateCardData = [
    { itemName: "Flier", specification: "A4 front/back, 4 + 4 Color Printing, 90 GSM sinar mass", volumeSlabs: [{ slab: "1000", price: 4.95 }, { slab: "5000", price: 1.92 }] },
    { itemName: "Poster", specification: "19 by 29 inches, 170 GSM, Art Paper", volumeSlabs: [{ slab: "100", price: 75.0 }, { slab: "1000", price: 19.35 }] },
    { itemName: "Standee", specification: "3 ft by 6 ft, Rollup, Star Flex", volumeSlabs: [{ slab: "1-10", price: 1100.0 }, { slab: "11-50", price: 975.0 }] },
    { itemName: "Dangler", specification: "Size: A4, 300 GSM, Front Back printing", volumeSlabs: [{ slab: "1000", price: 9.7 }, { slab: "5000", price: 4.95 }] },
    { itemName: "Brochure", specification: "A4 Closed, 16 Pages+ Cover", volumeSlabs: [{ slab: "1000", price: 41.71 }] },
  ]

  for (const item of rateCardData) {
    await prisma.rateCard.create({ data: item })
  }
  console.log("Rate cards created")

  // Create projects with all statuses
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const projectTemplates = [
    {
      name: "Expansion Kit - Ranchi",
      location: "Ranchi",
      branch: "Head Office",
      state: "Jharkhand",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "Certificate", "quantity": 200.0, "unitPrice": 10.0, "totalPrice": 2000.0}, {"itemName": "Gold Medal", "quantity": 4.0, "unitPrice": 150.0, "totalPrice": 600.0}, {"itemName": "Silver Medal", "quantity": 4.0, "unitPrice": 150.0, "totalPrice": 600.0}, {"itemName": "Bronze Medal", "quantity": 4.0, "unitPrice": 150.0, "totalPrice": 600.0}, {"itemName": "Drawing Sheet", "quantity": 200.0, "unitPrice": 10.0, "totalPrice": 2000.0}, {"itemName": "Crayon", "quantity": 50.0, "unitPrice": 20.0, "totalPrice": 1000.0}],
      totalCost: 8550.0,
      grandTotal: 9909.0,
      packingCharges: 500.0,
      createdAt: new Date('2026-04-15T00:00:00Z'),
      deliveryDate: new Date('2026-04-17T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Marketing Collateral - Sohna Road",
      location: "Gurugram",
      branch: "Head Office",
      state: "Haryana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 7,
      collaterals: [{"itemName": "Poster A3", "quantity": 2.0, "unitPrice": 30.0, "totalPrice": 60.0}, {"itemName": "Rollup Standee", "quantity": 2.0, "unitPrice": 1250.0, "totalPrice": 2500.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}],
      totalCost: 6060.0,
      grandTotal: 7151.0,
      packingCharges: 1500.0,
      createdAt: new Date('2026-01-12T00:00:00Z'),
      deliveryDate: new Date('2026-01-13T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Agency Expansion Kit - Bangalore",
      location: "Bangaluru",
      branch: "Head Office",
      state: "Karnataka",
      status: ProjectStatus.DELIVERED,
      pocIndex: 7,
      collaterals: [{"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1800.0, "totalPrice": 1800.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1800.0, "totalPrice": 1800.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1800.0, "totalPrice": 1800.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1800.0, "totalPrice": 1800.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1800.0, "totalPrice": 1800.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 20.0, "totalPrice": 4000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 20.0, "totalPrice": 4000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 20.0, "totalPrice": 4000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 20.0, "totalPrice": 4000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 20.0, "totalPrice": 4000.0}],
      totalCost: 30500.0,
      grandTotal: 35990.0,
      packingCharges: 1500.0,
      createdAt: new Date('2026-01-21T00:00:00Z'),
      deliveryDate: new Date('2026-01-22T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Recruitment Activities Kit, Handouts, Flyers, Pamphlets",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "Drawing Sheet", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}],
      totalCost: 11750.0,
      grandTotal: 13865.0,
      packingCharges: 500.0,
      createdAt: new Date('2026-01-29T00:00:00Z'),
      deliveryDate: new Date('2026-02-10T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Recruitment Collaterals for Hyderabad Office (OYZ)",
      location: "Hyderabad",
      branch: "Head Office",
      state: "Telangana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "One Pager A4", "quantity": 3000.0, "unitPrice": 6.0, "totalPrice": 18000.0}, {"itemName": "One Pager A4", "quantity": 3000.0, "unitPrice": 6.0, "totalPrice": 18000.0}],
      totalCost: 36500.0,
      grandTotal: 43070.0,
      packingCharges: 500.0,
      createdAt: new Date('2026-02-11T00:00:00Z'),
      deliveryDate: new Date('2026-02-18T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "CEO visit in Bhubaneshwar office 24 Feb",
      location: "Bhubaneswar",
      branch: "Head Office",
      state: "Odisha",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "Rollup Standee", "quantity": 2.0, "unitPrice": 1250.0, "totalPrice": 2500.0}, {"itemName": "Poster A3", "quantity": 10.0, "unitPrice": 30.0, "totalPrice": 300.0}, {"itemName": "One Pager A4", "quantity": 100.0, "unitPrice": 10.0, "totalPrice": 1000.0}],
      totalCost: 4300.0,
      grandTotal: 5074.0,
      packingCharges: 500.0,
      createdAt: new Date('2026-02-11T00:00:00Z'),
      deliveryDate: new Date('2026-02-19T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Sujeet IMF Marketing Collaterals",
      location: "New Delhi",
      branch: "Head Office",
      state: "Delhi",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}],
      totalCost: 15500.0,
      grandTotal: 18290.0,
      packingCharges: 500.0,
      createdAt: new Date('2026-02-09T00:00:00Z'),
      deliveryDate: new Date('2026-03-06T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Nizamabad Collaterals (OYZ)",
      location: "Nizamabad",
      branch: "Head Office",
      state: "Telangana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "Canopy", "quantity": 1.0, "unitPrice": 2200.0, "totalPrice": 2200.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "One Pager A4", "quantity": 800.0, "unitPrice": 10.0, "totalPrice": 8000.0}, {"itemName": "One Pager A4", "quantity": 100.0, "unitPrice": 10.0, "totalPrice": 1000.0}, {"itemName": "One Pager A4", "quantity": 100.0, "unitPrice": 10.0, "totalPrice": 1000.0}, {"itemName": "One Pager A4", "quantity": 100.0, "unitPrice": 10.0, "totalPrice": 1000.0}, {"itemName": "Drawing Sheet", "quantity": 250.0, "unitPrice": 10.0, "totalPrice": 2500.0}, {"itemName": "Certificate", "quantity": 250.0, "unitPrice": 10.0, "totalPrice": 2500.0}, {"itemName": "Crayon", "quantity": 250.0, "unitPrice": 20.0, "totalPrice": 5000.0}],
      totalCost: 26450.0,
      grandTotal: 30311.0,
      packingCharges: 2000.0,
      createdAt: new Date('2026-02-11T00:00:00Z'),
      deliveryDate: new Date('2026-02-13T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Research Partner Visit @Branches- March'26",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "Rollup Standee", "quantity": 10.0, "unitPrice": 2000.0, "totalPrice": 20000.0}, {"itemName": "Poster A3", "quantity": 10.0, "unitPrice": 30.0, "totalPrice": 300.0}, {"itemName": "Poster A3", "quantity": 10.0, "unitPrice": 30.0, "totalPrice": 300.0}],
      totalCost: 25600.0,
      grandTotal: 30208.0,
      packingCharges: 5000.0,
      createdAt: new Date('2026-03-09T00:00:00Z'),
      deliveryDate: new Date('2026-03-10T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Product Single Pager And Leaflet POLICY RIDER IMF",
      location: "Hathras",
      branch: "Head Office",
      state: "UP",
      status: ProjectStatus.DELIVERED,
      pocIndex: 7,
      collaterals: [{"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}, {"itemName": "One Pager A4", "quantity": 25.0, "unitPrice": 10.0, "totalPrice": 250.0}],
      totalCost: 1100.0,
      grandTotal: 1298.0,
      packingCharges: 100.0,
      createdAt: new Date('2026-03-12T00:00:00Z'),
      deliveryDate: new Date('2026-03-18T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Marketing Collateral - 2 Canopy",
      location: "Alwar",
      branch: "Head Office",
      state: "Rajasthan",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "Canopy", "quantity": 2.0, "unitPrice": 2200.0, "totalPrice": 4400.0}],
      totalCost: 5000.0,
      grandTotal: 5900.0,
      packingCharges: 600.0,
      createdAt: new Date('2026-03-12T00:00:00Z'),
      deliveryDate: new Date('2026-04-29T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Fraud Awareness Campaign",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.APPROVED,
      pocIndex: 3,
      collaterals: [{"itemName": "Poster A3", "quantity": 940.0, "unitPrice": 30.0, "totalPrice": 28200.0}],
      totalCost: 32200.0,
      grandTotal: 37996.0,
      packingCharges: 4000.0,
      createdAt: new Date('2026-03-17T00:00:00Z'),
      deliveryDate: new Date('2026-05-01T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.APPROVED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Expansion Kit Azamgarh",
      location: "Azamgarh",
      branch: "Head Office",
      state: "UP",
      status: ProjectStatus.DELIVERED,
      pocIndex: 3,
      collaterals: [{"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "Rollup Standee", "quantity": 1.0, "unitPrice": 1250.0, "totalPrice": 1250.0}, {"itemName": "Poster A3", "quantity": 1.0, "unitPrice": 30.0, "totalPrice": 30.0}, {"itemName": "Poster A3", "quantity": 1.0, "unitPrice": 30.0, "totalPrice": 30.0}, {"itemName": "Poster A3", "quantity": 1.0, "unitPrice": 30.0, "totalPrice": 30.0}, {"itemName": "Poster A3", "quantity": 1.0, "unitPrice": 30.0, "totalPrice": 30.0}, {"itemName": "Poster A3", "quantity": 1.0, "unitPrice": 30.0, "totalPrice": 30.0}, {"itemName": "Dangler", "quantity": 20.0, "unitPrice": 15.0, "totalPrice": 300.0}, {"itemName": "Tent Card A5", "quantity": 10.0, "unitPrice": 20.0, "totalPrice": 200.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 10.0, "totalPrice": 2000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 10.0, "totalPrice": 2000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 10.0, "totalPrice": 2000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 10.0, "totalPrice": 2000.0}, {"itemName": "One Pager A4", "quantity": 200.0, "unitPrice": 10.0, "totalPrice": 2000.0}, {"itemName": "Canopy", "quantity": 1.0, "unitPrice": 2200.0, "totalPrice": 2200.0}],
      totalCost: 20600.0,
      grandTotal: 24308.0,
      packingCharges: 1500.0,
      createdAt: new Date('2026-03-20T00:00:00Z'),
      deliveryDate: new Date('2026-04-10T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "CABR Collaterals",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 0,
      collaterals: [{"itemName": "One Pager A4", "quantity": 2000.0, "unitPrice": 4.5, "totalPrice": 9000.0}, {"itemName": "One Pager A4", "quantity": 2500.0, "unitPrice": 4.5, "totalPrice": 11250.0}, {"itemName": "One Pager A4", "quantity": 1250.0, "unitPrice": 8.0, "totalPrice": 10000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "One Pager A4", "quantity": 750.0, "unitPrice": 10.0, "totalPrice": 7500.0}, {"itemName": "One Pager A4", "quantity": 2000.0, "unitPrice": 4.5, "totalPrice": 9000.0}, {"itemName": "One Pager A4", "quantity": 2500.0, "unitPrice": 4.5, "totalPrice": 11250.0}, {"itemName": "One Pager A4", "quantity": 1250.0, "unitPrice": 8.0, "totalPrice": 10000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "One Pager A4", "quantity": 750.0, "unitPrice": 10.0, "totalPrice": 7500.0}],
      totalCost: 98500.0,
      grandTotal: 116230.0,
      packingCharges: 3000.0,
      createdAt: new Date('2026-04-22T00:00:00Z'),
      deliveryDate: new Date('2026-04-29T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "CABR Collaterals",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 0,
      collaterals: [{"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "Rollup Standee", "quantity": 4.0, "unitPrice": 1350.0, "totalPrice": 5400.0}, {"itemName": "Poster A3", "quantity": 15.0, "unitPrice": 30.0, "totalPrice": 450.0}],
      totalCost: 11350.0,
      grandTotal: 13393.0,
      packingCharges: 500.0,
      createdAt: new Date('2026-04-06T00:00:00Z'),
      deliveryDate: new Date('2026-04-08T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Marketing Material",
      location: "Mumbai",
      branch: "Head Office",
      state: "Maharashtra",
      status: ProjectStatus.DELIVERED,
      pocIndex: 0,
      collaterals: [{"itemName": "Poster A3", "quantity": 100.0, "unitPrice": 30.0, "totalPrice": 3000.0}, {"itemName": "Poster A3", "quantity": 100.0, "unitPrice": 30.0, "totalPrice": 3000.0}],
      totalCost: 6100.0,
      grandTotal: 7198.0,
      packingCharges: 100.0,
      createdAt: new Date('2026-03-06T00:00:00Z'),
      deliveryDate: new Date('2026-03-10T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Lifestyle survey one pager",
      location: "Gurugram",
      branch: "Head Office",
      state: "Haryana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 0,
      collaterals: [{"itemName": "One Pager A4", "quantity": 1000.0, "unitPrice": 6.0, "totalPrice": 6000.0}],
      totalCost: 6200.0,
      grandTotal: 7316.0,
      packingCharges: 200.0,
      createdAt: new Date('2026-02-13T00:00:00Z'),
      deliveryDate: new Date('2026-02-18T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "One pagers and posters",
      location: "Secunderabad",
      branch: "Head Office",
      state: "Telangana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 0,
      collaterals: [{"itemName": "One Pager A4", "quantity": 1000.0, "unitPrice": 10.0, "totalPrice": 10000.0}, {"itemName": "One Pager A4", "quantity": 1500.0, "unitPrice": 10.0, "totalPrice": 15000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "One Pager A4", "quantity": 500.0, "unitPrice": 10.0, "totalPrice": 5000.0}, {"itemName": "Brochure", "quantity": 500.0, "unitPrice": 25.0, "totalPrice": 12500.0}, {"itemName": "Poster A3", "quantity": 10.0, "unitPrice": 30.0, "totalPrice": 300.0}, {"itemName": "Poster A3", "quantity": 10.0, "unitPrice": 30.0, "totalPrice": 300.0}, {"itemName": "Poster A3", "quantity": 10.0, "unitPrice": 30.0, "totalPrice": 300.0}],
      totalCost: 50400.0,
      grandTotal: 59427.0,
      packingCharges: 2000.0,
      createdAt: new Date('2026-01-13T00:00:00Z'),
      deliveryDate: new Date('2026-01-18T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Jo Jeeta Wohi Sikandar Contest",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.APPROVED,
      pocIndex: 5,
      collaterals: [{"itemName": "Gold Medal", "quantity": 271.0, "unitPrice": 200.0, "totalPrice": 54200.0}],
      totalCost: 57200.0,
      grandTotal: 67496.0,
      packingCharges: 3000.0,
      createdAt: new Date('2026-03-24T00:00:00Z'),
      deliveryDate: new Date('2026-05-01T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.APPROVED, note: "Imported from CSV" },
      ],
    },
    {
      name: "JFM Posters",
      location: "Gurugram",
      branch: "Head Office",
      state: "Haryana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 6,
      collaterals: [{"itemName": "Poster", "quantity": 60.0, "unitPrice": 300.0, "totalPrice": 18000.0}],
      totalCost: 18600.0,
      grandTotal: 21948.0,
      packingCharges: 600.0,
      createdAt: new Date('2026-02-04T00:00:00Z'),
      deliveryDate: new Date('2026-02-05T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "JFM Posters",
      location: "Gurugram",
      branch: "Head Office",
      state: "Haryana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 6,
      collaterals: [{"itemName": "Poster", "quantity": 1.0, "unitPrice": 300.0, "totalPrice": 300.0}],
      totalCost: 310.0,
      grandTotal: 366.0,
      packingCharges: 10.0,
      createdAt: new Date('2026-02-04T00:00:00Z'),
      deliveryDate: new Date('2026-02-05T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Rakshak Certificate",
      location: "Gurugram",
      branch: "Head Office",
      state: "Haryana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 4,
      collaterals: [{"itemName": "Certificate", "quantity": 100.0, "unitPrice": 10.0, "totalPrice": 1000.0}],
      totalCost: 1100.0,
      grandTotal: 1298.0,
      packingCharges: 100.0,
      createdAt: new Date('2026-02-19T00:00:00Z'),
      deliveryDate: new Date('2026-02-20T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Table Presenters",
      location: "Gurugram",
      branch: "Head Office",
      state: "Haryana",
      status: ProjectStatus.DELIVERED,
      pocIndex: 4,
      collaterals: [{"itemName": "Table Presenter", "quantity": 35.0, "unitPrice": 275.0, "totalPrice": 9625.0}],
      totalCost: 9975.0,
      grandTotal: 11770.0,
      packingCharges: 350.0,
      createdAt: new Date('2026-02-19T00:00:00Z'),
      deliveryDate: new Date('2026-02-19T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Fridge Magnets for North Region",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 1,
      collaterals: [{"itemName": "Fridge Magnets", "quantity": 5000.0, "unitPrice": 18.0, "totalPrice": 90000.0}],
      totalCost: 90000.0,
      grandTotal: 106200.0,
      packingCharges: 0.0,
      createdAt: new Date('2026-01-12T00:00:00Z'),
      deliveryDate: new Date('2026-02-09T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Fridge Magnets for South Region",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 1,
      collaterals: [{"itemName": "Fridge Magnets", "quantity": 5000.0, "unitPrice": 18.0, "totalPrice": 90000.0}],
      totalCost: 90000.0,
      grandTotal: 106200.0,
      packingCharges: 0.0,
      createdAt: new Date('2026-01-12T00:00:00Z'),
      deliveryDate: new Date('2026-02-09T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Fridge Magnets for East Region",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 1,
      collaterals: [{"itemName": "Fridge Magnets", "quantity": 5000.0, "unitPrice": 18.0, "totalPrice": 90000.0}],
      totalCost: 90000.0,
      grandTotal: 106200.0,
      packingCharges: 0.0,
      createdAt: new Date('2026-01-12T00:00:00Z'),
      deliveryDate: new Date('2026-02-09T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Fridge Magnets for West Region",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 1,
      collaterals: [{"itemName": "Fridge Magnets", "quantity": 5000.0, "unitPrice": 18.0, "totalPrice": 90000.0}],
      totalCost: 90000.0,
      grandTotal: 106200.0,
      packingCharges: 0.0,
      createdAt: new Date('2026-01-12T00:00:00Z'),
      deliveryDate: new Date('2026-02-09T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "SCW Bookmarks",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 1,
      collaterals: [{"itemName": "Bookmarks", "quantity": 10000.0, "unitPrice": 9.75, "totalPrice": 97500.0}],
      totalCost: 97500.0,
      grandTotal: 115050.0,
      packingCharges: 0.0,
      createdAt: new Date('2026-02-24T00:00:00Z'),
      deliveryDate: new Date('2026-02-28T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "SCW Silicone Band - East & West",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 1,
      collaterals: [{"itemName": "Silicone Band", "quantity": 5000.0, "unitPrice": 11.5, "totalPrice": 57500.0}],
      totalCost: 61500.0,
      grandTotal: 72570.0,
      packingCharges: 4000.0,
      createdAt: new Date('2026-03-27T00:00:00Z'),
      deliveryDate: new Date('2026-04-07T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "SCW Silicone Band - Norht & South",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 1,
      collaterals: [{"itemName": "Silicone Band", "quantity": 5000.0, "unitPrice": 11.5, "totalPrice": 57500.0}],
      totalCost: 61500.0,
      grandTotal: 72570.0,
      packingCharges: 4000.0,
      createdAt: new Date('2026-03-27T00:00:00Z'),
      deliveryDate: new Date('2026-04-07T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
    {
      name: "Elite Collaterals",
      location: "Unknown",
      branch: "Head Office",
      state: "Unknown",
      status: ProjectStatus.DELIVERED,
      pocIndex: 2,
      collaterals: [{"itemName": "Certificate", "quantity": 1000.0, "unitPrice": 8.0, "totalPrice": 8000.0}, {"itemName": "Promise Card", "quantity": 1000.0, "unitPrice": 4.0, "totalPrice": 4000.0}, {"itemName": "Welcome Letter", "quantity": 1000.0, "unitPrice": 8.0, "totalPrice": 8000.0}, {"itemName": "Flyer", "quantity": 1000.0, "unitPrice": 8.0, "totalPrice": 8000.0}, {"itemName": "Invite Letter", "quantity": 1000.0, "unitPrice": 8.0, "totalPrice": 8000.0}, {"itemName": "Poster A3", "quantity": 51.0, "unitPrice": 30.0, "totalPrice": 1530.0}],
      totalCost: 39030.0,
      grandTotal: 46055.0,
      packingCharges: 1500.0,
      createdAt: new Date('2026-02-23T00:00:00Z'),
      deliveryDate: new Date('2026-02-26T00:00:00Z'),
      leadsGenerated: 0,
      leadsConverted: 0,
      statusHistory: [
        { status: ProjectStatus.DELIVERED, note: "Imported from CSV" },
      ],
    },
  ]

  for (let i = 0; i < projectTemplates.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = projectTemplates[i] as any
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
        deliveryDate: proj.deliveryDate,
        status: proj.status,
        totalCost: proj.totalCost,
        grandTotal: proj.grandTotal,
        packingCharges: proj.packingCharges,
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
    if (proj.leadsGenerated || proj.leadsConverted) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          leadsGenerated: proj.leadsGenerated,
          leadsConverted: proj.leadsConverted,
        },
      })
    }

    // Add POD file URL to dispatch if dispatch exists
    if (proj.dispatch) {
      const podFile = proj.files?.find((f: { type: string }) => f.type === "POD")
      if (podFile) {
        await prisma.dispatch.update({
          where: { projectId: project.id },
          data: { podUrl: podFile.url },
        })
      }
    }

    // Create approval for all projects
    let appStatus = ApprovalStatus.PENDING
    if (proj.status === ProjectStatus.CANCELLED) {
      appStatus = ApprovalStatus.REJECTED
    } else if (proj.status !== ProjectStatus.REQUESTED) {
      appStatus = ApprovalStatus.APPROVED
    }

    await prisma.approval.create({
      data: {
        projectId: project.id,
        requestedById: pocs[proj.pocIndex].id,
        status: appStatus,
        reminderCount: 0,
        approvedAt: appStatus === ApprovalStatus.APPROVED ? new Date() : null,
      },
    })

    console.log(`Created project: ${proj.name} (${proj.status})`)
  }

  console.log("\n========================================")
  console.log("SEED COMPLETED SUCCESSFULLY!")
  console.log("========================================")
  console.log("\nLogin Credentials:")
  console.log("Admin:    admin@axismaxlife.com / Admin@123")
  console.log("POCs:     [name]@axismaxlife.com / Poc@123")
  console.log("\nInitial Data Seeded:")
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
