-- CreateIndex
CREATE INDEX `Attendance_userId_type_date_idx` ON `Attendance`(`userId`, `type`, `date`);

-- CreateIndex
CREATE INDEX `Expense_userId_status_date_idx` ON `Expense`(`userId`, `status`, `date`);

-- CreateIndex
CREATE INDEX `Expense_userId_type_date_idx` ON `Expense`(`userId`, `type`, `date`);

-- CreateIndex
CREATE INDEX `Expense_date_status_idx` ON `Expense`(`date`, `status`);

-- CreateIndex
CREATE INDEX `Shift_userId_status_date_idx` ON `Shift`(`userId`, `status`, `date`);

-- CreateIndex
CREATE INDEX `Shift_date_status_idx` ON `Shift`(`date`, `status`);

-- CreateIndex
CREATE INDEX `User_partnerId_customRoleId_idx` ON `User`(`partnerId`, `customRoleId`);
