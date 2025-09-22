-- Consolidate concierge_id into admin_id
-- First, update admin_id with values from concierge_id where admin_id is empty or default
UPDATE "Organization" 
SET "admin_id" = "concierge_id" 
WHERE "concierge_id" IS NOT NULL 
AND ("admin_id" IS NULL OR "admin_id" = '');

-- Drop the concierge_id column
ALTER TABLE "Organization" DROP COLUMN "concierge_id";

-- Drop the concierge index
DROP INDEX IF EXISTS "idx_organizations_concierge_id";

-- Drop the concierge foreign key constraint
ALTER TABLE "Organization" DROP CONSTRAINT IF EXISTS "Organization_concierge_id_fkey";
