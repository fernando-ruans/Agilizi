-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN "costPrice" REAL;

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "images_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "images_ownerType_ownerId_idx" ON "images"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "images_companyId_idx" ON "images"("companyId");

