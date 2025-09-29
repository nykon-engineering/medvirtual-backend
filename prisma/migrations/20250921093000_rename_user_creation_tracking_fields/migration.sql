-- Rename columns to preserve existing data
ALTER TABLE "USER" RENAME COLUMN "created_by_method" TO "createdByMethod";
ALTER TABLE "USER" RENAME COLUMN "created_by_user_id" TO "createdByUserId";

-- Drop old indexes
DROP INDEX IF EXISTS "idx_users_created_by_method";
DROP INDEX IF EXISTS "idx_users_created_by_user_id";

-- Create new indexes with camelCase names
CREATE INDEX "idx_users_created_by_method" ON "USER"("createdByMethod");
CREATE INDEX "idx_users_created_by_user_id" ON "USER"("createdByUserId");

-- Drop old foreign key constraint
ALTER TABLE "USER" DROP CONSTRAINT IF EXISTS "USER_created_by_user_id_fkey";

-- Add new foreign key constraint with camelCase column name
ALTER TABLE "USER" ADD CONSTRAINT "USER_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
