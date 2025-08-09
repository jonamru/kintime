import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixSystemSettings() {
  console.log("システム設定を確認中...");

  try {
    // 既存のシステム設定を確認
    let settings = await prisma.systemSetting.findFirst();
    
    if (!settings) {
      console.log("システム設定が存在しません。作成します...");
      settings = await prisma.systemSetting.create({
        data: {
          shiftApprovalDeadlineDays: 3,
          companyName: null,
          companyUserIdPrefix: null,
          headerCopyright: null,
        },
      });
      console.log("システム設定を作成しました:", settings);
    } else {
      console.log("既存のシステム設定:", settings);
    }

    // すべてのユーザーの権限状態を確認
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        customRoleId: true,
      },
    });

    console.log("\n全ユーザーの状態:");
    users.forEach(user => {
      console.log(`- ${user.email}: role=${user.role}, customRoleId=${user.customRoleId}`);
    });

    // カスタムロールの状態を確認
    const roles = await prisma.customRole.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        isSystem: true,
      },
    });

    console.log("\nカスタムロール:");
    roles.forEach(role => {
      console.log(`- ${role.name} (${role.displayName}): system=${role.isSystem}`);
    });

  } catch (error) {
    console.error("エラー:", error);
  }
}

fixSystemSettings()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });