-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "additional_training_requested" TEXT,
ADD COLUMN     "hubspot_n2_monitors_required" TEXT,
ADD COLUMN     "hubspot_special_requirements" TEXT,
ADD COLUMN     "hubspot_special_sourcing_needed" TEXT,
ADD COLUMN     "hubspot_tasks" TEXT,
ADD COLUMN     "hubspot_va_shift_hours" TEXT;
