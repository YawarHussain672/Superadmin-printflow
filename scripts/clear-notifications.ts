import { prisma } from "../src/lib/prisma"

async function main() {
  const before = await prisma.notification.count()
  console.log(`Notifications before cleanup: ${before}`)

  const deleted = await prisma.notification.deleteMany()
  console.log(`Deleted ${deleted.count} notifications`)

  const after = await prisma.notification.count()
  console.log(`Notifications after cleanup: ${after}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
