import { PrismaClient, ApprovalStatus } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Delete all existing approvals
  await prisma.approval.deleteMany({})
  console.log("Cleared existing approvals")

  // Get admin user
  const admin = await prisma.user.findUnique({
    where: { email: "admin@axismaxlife.com" },
  })

  if (!admin) {
    console.log("Admin user not found")
    return
  }

  // Get first 3 projects
  const projects = await prisma.project.findMany({ take: 3 })
  
  // Create PENDING approvals for each
  for (const project of projects) {
    await prisma.approval.create({
      data: {
        projectId: project.id,
        requestedById: admin.id,
        status: ApprovalStatus.PENDING,
        reminderCount: 0,
      },
    })
    console.log(`Created PENDING approval for project: ${project.projectId}`)
  }

  console.log("Done! Created", projects.length, "PENDING approvals")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
