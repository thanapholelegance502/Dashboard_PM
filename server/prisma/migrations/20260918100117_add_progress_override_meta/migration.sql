-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "progressOverrideAt" TIMESTAMP(3),
ADD COLUMN     "progressOverrideBy" INTEGER,
ADD COLUMN     "progressOverrideReason" TEXT;
