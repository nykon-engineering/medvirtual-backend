-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "hubspot_business_unit" TEXT,
ADD COLUMN     "hubspot_company_name" TEXT,
ADD COLUMN     "hubspot_company_url" TEXT,
ADD COLUMN     "hubspot_pairing_request_type" TEXT,
ADD COLUMN     "hubspot_pipeline" TEXT,
ADD COLUMN     "hubspot_pipeline_stage" TEXT,
ADD COLUMN     "hubspot_ticket_type" TEXT;
