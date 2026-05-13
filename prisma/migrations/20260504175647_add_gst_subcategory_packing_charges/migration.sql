-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "packingCharges" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rate_cards" ADD COLUMN     "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
ADD COLUMN     "subcategory" TEXT;
