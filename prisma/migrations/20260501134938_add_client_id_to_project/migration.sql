/*
  Warnings:

  - Made the column `userId` on table `activities` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "FileType" ADD VALUE 'POD';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CLIENT';

-- DropIndex
DROP INDEX "rate_cards_itemName_key";

-- AlterTable
ALTER TABLE "activities" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "clientId" TEXT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
