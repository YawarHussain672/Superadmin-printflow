import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting backfill for POC and Client names...")
  
  const projects = await prisma.project.findMany({
    include: {
      poc: { select: { name: true } },
      client: { select: { name: true } },
    }
  })
  
  console.log(`Found ${projects.length} projects to check.`)
  
  let updatedCount = 0
  for (const project of projects) {
    const pocName = project.poc?.name || null
    const clientName = project.client?.name || null
    
    // Only update if names need setting
    if (pocName !== project.pocName || clientName !== project.clientName) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          pocName: pocName,
          clientName: clientName,
        }
      })
      updatedCount++
    }
  }
  
  console.log(`Backfill completed. Updated ${updatedCount} projects.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
