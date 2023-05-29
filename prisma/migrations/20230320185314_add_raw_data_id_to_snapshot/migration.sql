/*
  Warnings:

  - Added the required column `rawDataId` to the `Snapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "rawDataId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_rawDataId_fkey" FOREIGN KEY ("rawDataId") REFERENCES "RawData"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
