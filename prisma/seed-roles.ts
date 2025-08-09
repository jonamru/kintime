import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedRoles() {
  console.log("Creating default roles...");

  // デフォルトのロールを作成
  const defaultRoles = [
    {
      name: "SUPER_ADMIN",
      displayName: "システム管理者",
      isSystem: true,
      permissions: {
        userManagement: {
          create: true,
          edit: true,
          delete: true,
          viewAll: true,
        },
        shiftManagement: {
          approve: true,
          edit: true,
          delete: true,
          viewAll: true,
          forceRegister: true,
          lockUnlock: true,
        },
        attendanceManagement: {
          viewAll: true,
          forceClockInOut: true,
          editOthers: true,
        },
        expenseManagement: {
          approve: true,
          viewAll: true,
          lock: true,
        },
        systemSettings: {
          manageCompany: true,
          manageRoles: true,
          managePartners: true,
        },
      },
      pageAccess: {
        dashboard: true,
        attendance: true,
        attendanceHistory: true,
        shiftRequest: true,
        shiftWorkers: true,
        shiftOverview: true,
        shiftRegister: true,
        shiftLock: true,
        expense: true,
        expenseMonthly: true,
        reports: true,
        adminUsers: true,
        adminPartners: true,
        adminSystemSettings: true,
        adminSystem: true, // 新しい管理ページ
      },
    },
    {
      name: "MANAGER",
      displayName: "マネージャー",
      isSystem: true,
      permissions: {
        userManagement: {
          create: true,
          edit: true,
          delete: false,
          viewAll: true,
        },
        shiftManagement: {
          approve: true,
          edit: true,
          delete: true,
          viewAll: true,
          forceRegister: true,
          lockUnlock: true,
        },
        attendanceManagement: {
          viewAll: true,
          forceClockInOut: true,
          editOthers: false,
        },
        expenseManagement: {
          approve: false,
          viewAll: true,
          lock: false,
        },
        systemSettings: {
          manageCompany: false,
          manageRoles: false,
          managePartners: false,
        },
      },
      pageAccess: {
        dashboard: true,
        attendance: true,
        attendanceHistory: true,
        shiftRequest: true,
        shiftWorkers: true,
        shiftOverview: true,
        shiftRegister: true,
        shiftLock: true,
        expense: true,
        expenseMonthly: true,
        reports: true,
        adminUsers: true,
        adminPartners: false,
        adminSystemSettings: true,
        adminSystem: false,
      },
    },
    {
      name: "STAFF",
      displayName: "スタッフ",
      isSystem: true,
      permissions: {
        userManagement: {
          create: false,
          edit: false,
          delete: false,
          viewAll: false,
        },
        shiftManagement: {
          approve: false,
          edit: false,
          delete: false,
          viewAll: false,
          forceRegister: false,
          lockUnlock: false,
        },
        attendanceManagement: {
          viewAll: false,
          forceClockInOut: false,
          editOthers: false,
        },
        expenseManagement: {
          approve: false,
          viewAll: false,
          lock: false,
        },
        systemSettings: {
          manageCompany: false,
          manageRoles: false,
          managePartners: false,
        },
      },
      pageAccess: {
        dashboard: true,
        attendance: true,
        attendanceHistory: true,
        shiftRequest: true,
        shiftWorkers: false,
        shiftOverview: false,
        shiftRegister: false,
        shiftLock: false,
        expense: true,
        expenseMonthly: true,
        reports: false,
        adminUsers: false,
        adminPartners: false,
        adminSystemSettings: false,
        adminSystem: false,
      },
    },
  ];

  for (const roleData of defaultRoles) {
    await prisma.customRole.upsert({
      where: { name: roleData.name },
      update: {
        displayName: roleData.displayName,
        permissions: roleData.permissions,
        pageAccess: roleData.pageAccess,
      },
      create: roleData,
    });
    console.log(`Created/Updated role: ${roleData.displayName}`);
  }

  console.log("Default roles created successfully!");
}

seedRoles()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });