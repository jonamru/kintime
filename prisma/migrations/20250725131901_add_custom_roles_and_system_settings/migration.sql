/*
  Warnings:

  - You are about to alter the column `role` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(4))` to `VarChar(191)`.
  - You are about to drop the `SystemSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `SystemSetting` ADD COLUMN `headerCopyright` VARCHAR(191) NULL,
    ADD COLUMN `shiftApprovalDeadlineDays` INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `customRoleId` VARCHAR(191) NULL,
    MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'STAFF';

-- DropTable
DROP TABLE `SystemSettings`;

-- CreateTable
CREATE TABLE `CustomRole` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `permissions` JSON NOT NULL,
    `pageAccess` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomRole_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_customRoleId_idx` ON `User`(`customRoleId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_customRoleId_fkey` FOREIGN KEY (`customRoleId`) REFERENCES `CustomRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
