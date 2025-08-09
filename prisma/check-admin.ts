import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function checkAndFixAdmin() {
  console.log("管理者ユーザーをチェック中...");

  // 管理者ユーザーを検索
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });

  if (!adminUser) {
    console.log("管理者ユーザーが見つかりません。作成します...");
    
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    // 管理者ユーザーを作成
    const newAdmin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        password: hashedPassword,
        name: "システム管理者",
        role: "SUPER_ADMIN",
        userId: "ADMIN-001",
      },
    });
    
    console.log("管理者ユーザーを作成しました:", newAdmin);
  } else {
    console.log("既存の管理者ユーザー:", {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    });
    
    // roleがenumの値のままの場合は文字列に更新
    if (!["SUPER_ADMIN", "MANAGER", "STAFF"].includes(adminUser.role)) {
      console.log("不正なロール値を修正中...");
      const updated = await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: "SUPER_ADMIN" },
      });
      console.log("ロールを更新しました:", updated.role);
    }
  }

  // すべてのユーザーのロールを確認
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log("\n全ユーザーのロール状態:");
  allUsers.forEach(user => {
    console.log(`- ${user.email}: ${user.role}`);
  });
}

checkAndFixAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });