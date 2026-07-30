-- CreateTable
CREATE TABLE "ProfilePhotoAsset" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilePhotoAsset_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "showPhoto" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePhotoAsset_profileId_key" ON "ProfilePhotoAsset"("profileId");

-- AddForeignKey
ALTER TABLE "ProfilePhotoAsset" ADD CONSTRAINT "ProfilePhotoAsset_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
