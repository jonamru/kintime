/*
  Warnings:

  - You are about to drop the column `managerId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_managerId_fkey`;

-- DropIndex
DROP INDEX `User_managerId_idx` ON `User`;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `managerId`;

-- CreateTable
CREATE TABLE `_UserManagers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_UserManagers_AB_unique`(`A`, `B`),
    INDEX `_UserManagers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_UserManagers` ADD CONSTRAINT `_UserManagers_A_fkey` FOREIGN KEY (`A`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserManagers` ADD CONSTRAINT `_UserManagers_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
