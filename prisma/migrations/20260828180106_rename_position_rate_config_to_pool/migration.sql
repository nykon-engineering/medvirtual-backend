-- Rename PositionRateConfig columns from per-brand (medVirtual_*/berryVirtual_*)
-- to per-candidate_pool (medical_*/non_medical_*), preserving existing values.
-- MedVirtual's candidate_pool is "medical"; Berry Virtual's is "non_medical".
ALTER TABLE "PositionRateConfig" RENAME COLUMN "medVirtual_floor_price_english" TO "medical_floor_price_english";
ALTER TABLE "PositionRateConfig" RENAME COLUMN "medVirtual_floor_price_bilingual" TO "medical_floor_price_bilingual";
ALTER TABLE "PositionRateConfig" RENAME COLUMN "medVirtual_margin_per_hour" TO "medical_margin_per_hour";
ALTER TABLE "PositionRateConfig" RENAME COLUMN "berryVirtual_floor_price_english" TO "non_medical_floor_price_english";
ALTER TABLE "PositionRateConfig" RENAME COLUMN "berryVirtual_floor_price_bilingual" TO "non_medical_floor_price_bilingual";
ALTER TABLE "PositionRateConfig" RENAME COLUMN "berryVirtual_margin_per_hour" TO "non_medical_margin_per_hour";
