-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "piGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "piPdfUrl" TEXT,
ADD COLUMN     "piStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN     "piVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "piVerifiedBy" TEXT;
