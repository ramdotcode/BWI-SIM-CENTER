/*
  Warnings:

  - Changed the type of `kind` on the `pending_uploads` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "pending_uploads" DROP COLUMN "kind",
ADD COLUMN     "kind" TEXT NOT NULL;
