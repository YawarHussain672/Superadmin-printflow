-- Drop existing foreign keys that reference users
ALTER TABLE "public"."projects" DROP CONSTRAINT IF EXISTS "projects_pocId_fkey";
ALTER TABLE "public"."approvals" DROP CONSTRAINT IF EXISTS "approvals_requestedById_fkey";
ALTER TABLE "public"."approvals" DROP CONSTRAINT IF EXISTS "approvals_approvedById_fkey";
ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_userId_fkey";
ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";
ALTER TABLE "public"."status_history" DROP CONSTRAINT IF EXISTS "status_history_changedById_fkey";
ALTER TABLE "public"."file_uploads" DROP CONSTRAINT IF EXISTS "file_uploads_uploadedById_fkey";

-- Clean up orphaned records (records referencing non-existent users)
DELETE FROM "public"."notifications" WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM "public"."users");
DELETE FROM "public"."activities" WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM "public"."users");
DELETE FROM "public"."status_history" WHERE "changedById" IS NOT NULL AND "changedById" NOT IN (SELECT id FROM "public"."users");
DELETE FROM "public"."file_uploads" WHERE "uploadedById" IS NOT NULL AND "uploadedById" NOT IN (SELECT id FROM "public"."users");
DELETE FROM "public"."approvals" WHERE "requestedById" IS NOT NULL AND "requestedById" NOT IN (SELECT id FROM "public"."users");
DELETE FROM "public"."approvals" WHERE "approvedById" IS NOT NULL AND "approvedById" NOT IN (SELECT id FROM "public"."users");
UPDATE "public"."projects" SET "pocId" = NULL WHERE "pocId" IS NOT NULL AND "pocId" NOT IN (SELECT id FROM "public"."users");

-- Make foreign key columns nullable where needed
ALTER TABLE "public"."projects" ALTER COLUMN "pocId" DROP NOT NULL;
ALTER TABLE "public"."notifications" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "public"."activities" ALTER COLUMN "userId" DROP NOT NULL;

-- Add foreign keys with proper ON DELETE behavior
-- Projects: Set NULL when POC is deleted
ALTER TABLE "public"."projects" 
  ADD CONSTRAINT "projects_pocId_fkey" 
  FOREIGN KEY ("pocId") REFERENCES "public"."users"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Approvals: CASCADE for requestedBy (delete approval when user deleted)
ALTER TABLE "public"."approvals" 
  ADD CONSTRAINT "approvals_requestedById_fkey" 
  FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Approvals: SET NULL for approvedBy
ALTER TABLE "public"."approvals" 
  ADD CONSTRAINT "approvals_approvedById_fkey" 
  FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Activities: CASCADE when user deleted
ALTER TABLE "public"."activities" 
  ADD CONSTRAINT "activities_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Notifications: SET NULL when user deleted
ALTER TABLE "public"."notifications" 
  ADD CONSTRAINT "notifications_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- StatusHistory: SET NULL when user deleted
ALTER TABLE "public"."status_history" 
  ADD CONSTRAINT "status_history_changedById_fkey" 
  FOREIGN KEY ("changedById") REFERENCES "public"."users"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FileUploads: SET NULL when user deleted
ALTER TABLE "public"."file_uploads" 
  ADD CONSTRAINT "file_uploads_uploadedById_fkey" 
  FOREIGN KEY ("uploadedById") REFERENCES "public"."users"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;
