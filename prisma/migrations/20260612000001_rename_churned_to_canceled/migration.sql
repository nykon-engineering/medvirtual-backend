-- Rename enum value 'churned' to 'canceled' in ReferralStage
ALTER TYPE "ReferralStage" RENAME VALUE 'churned' TO 'canceled';
