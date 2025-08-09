import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateRoles() {
  try {
    console.log("開始: ロール統一マイグレーション");

    // 1. 既存のカスタムロールを確認
    const existingRoles = await prisma.customRole.findMany();
    console.log("既存のカスタムロール:", existingRoles.map(r => r.name));

    // 2. 標準ロールのデータ
    const systemRoles = [
      {
        name: "SUPER_ADMIN",
        displayName: "システム管理者",
        isSystem: true,
        permissions: {
          userManagement: { create: true, edit: true, delete: true, viewAll: true },
          shiftManagement: { approve: true, edit: true, delete: true, viewAll: true, forceRegister: true, lockUnlock: true },
          attendanceManagement: { viewAll: true, forceClockInOut: true, editOthers: true },
          expenseManagement: { approve: true, viewAll: true, lock: true },
          systemSettings: { manageCompany: true, manageRoles: true, managePartners: true },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: true, shiftOverview: true, shiftRegister: true, shiftLock: true,
          expense: true, expenseMonthly: true, adminUsers: true, adminPartners: true, adminSystem: true,
        },
      },
      {
        name: "MANAGER",
        displayName: "マネージャー",
        isSystem: true,
        permissions: {
          userManagement: { create: true, edit: true, delete: false, viewAll: true },
          shiftManagement: { approve: true, edit: true, delete: true, viewAll: true, forceRegister: true, lockUnlock: true },
          attendanceManagement: { viewAll: true, forceClockInOut: true, editOthers: false },
          expenseManagement: { approve: false, viewAll: true, lock: false },
          systemSettings: { manageCompany: false, manageRoles: false, managePartners: false },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: true, shiftOverview: true, shiftRegister: true, shiftLock: true,
          expense: true, expenseMonthly: true, adminUsers: true, adminPartners: false, adminSystem: false,
        },
      },
      {
        name: "PARTNER_MANAGER",
        displayName: "パートナー管理者",
        isSystem: true,
        permissions: {
          userManagement: { create: false, edit: false, delete: false, viewAll: false },
          shiftManagement: { approve: false, edit: true, delete: false, viewAll: true, forceRegister: false, lockUnlock: false },
          attendanceManagement: { viewAll: true, forceClockInOut: false, editOthers: false },
          expenseManagement: { approve: false, viewAll: false, lock: false },
          systemSettings: { manageCompany: false, manageRoles: false, managePartners: false },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: false, shiftOverview: true, shiftRegister: false, shiftLock: false,
          expense: true, expenseMonthly: true, adminUsers: false, adminPartners: false, adminSystem: false,
        },
      },
      {
        name: "STAFF",
        displayName: "スタッフ",
        isSystem: true,
        permissions: {
          userManagement: { create: false, edit: false, delete: false, viewAll: false },
          shiftManagement: { approve: false, edit: false, delete: false, viewAll: false, forceRegister: false, lockUnlock: false },
          attendanceManagement: { viewAll: false, forceClockInOut: false, editOthers: false },
          expenseManagement: { approve: false, viewAll: false, lock: false },
          systemSettings: { manageCompany: false, manageRoles: false, managePartners: false },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: false, shiftOverview: false, shiftRegister: false, shiftLock: false,
          expense: true, expenseMonthly: true, adminUsers: false, adminPartners: false, adminSystem: false,
        },
      },
      {
        name: "PARTNER_STAFF",
        displayName: "パートナースタッフ",
        isSystem: true,
        permissions: {
          userManagement: { create: false, edit: false, delete: false, viewAll: false },
          shiftManagement: { approve: false, edit: false, delete: false, viewAll: false, forceRegister: false, lockUnlock: false },
          attendanceManagement: { viewAll: false, forceClockInOut: false, editOthers: false },
          expenseManagement: { approve: false, viewAll: false, lock: false },
          systemSettings: { manageCompany: false, manageRoles: false, managePartners: false },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: false, shiftOverview: false, shiftRegister: false, shiftLock: false,
          expense: true, expenseMonthly: true, adminUsers: false, adminPartners: false, adminSystem: false,
        },
      },
    ];

    // 3. 標準ロールを作成/更新
    for (const role of systemRoles) {
      await prisma.customRole.upsert({
        where: { name: role.name },
        update: {
          displayName: role.displayName,
          isSystem: role.isSystem,
          permissions: role.permissions,
          pageAccess: role.pageAccess,
        },
        create: role,
      });
      console.log(`✓ ロール作成/更新: ${role.displayName}`);
    }

    // 4. 旧roleフィールドを持つユーザーを新しいcustomRoleIdに移行
    const usersWithOldRole = await prisma.$queryRaw`
      SELECT id, role FROM User WHERE customRoleId IS NULL OR customRoleId = ''
    ` as { id: string; role: string }[];

    console.log(`移行対象ユーザー数: ${usersWithOldRole.length}`);

    for (const user of usersWithOldRole) {
      const customRole = await prisma.customRole.findUnique({
        where: { name: user.role },
      });

      if (customRole) {
        await prisma.user.update({
          where: { id: user.id },
          data: { customRoleId: customRole.id },
        });
        console.log(`✓ ユーザー ${user.id} を ${user.role} -> ${customRole.displayName} に移行`);
      } else {
        console.warn(`⚠ ロール ${user.role} が見つかりません。ユーザー ${user.id} をSTAFFに設定します。`);
        const staffRole = await prisma.customRole.findUnique({
          where: { name: "STAFF" },
        });
        if (staffRole) {
          await prisma.user.update({
            where: { id: user.id },
            data: { customRoleId: staffRole.id },
          });
        }
      }
    }

    console.log("✅ ロール統一マイグレーション完了");
  } catch (error) {
    console.error("❌ マイグレーションエラー:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateRoles();