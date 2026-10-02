-- Remove obsolete AdminUser role default.
-- Staff role must always be chosen explicitly from the canonical role vocabulary.
ALTER TABLE "AdminUser"
ALTER COLUMN "role" DROP DEFAULT;
