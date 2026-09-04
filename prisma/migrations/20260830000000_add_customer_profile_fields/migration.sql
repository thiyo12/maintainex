-- Add customer profile details and phone verification flag
ALTER TABLE "CustomerProfile" ADD COLUMN "profileImage" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN "birthday" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN "gender" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN "language" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN "emergencyContact" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;