import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAllData() {
  console.log("データベースの内容を確認中...");

  try {
    // ユーザー情報を確認
    const users = await prisma.user.findMany({
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log("\n=== ユーザー情報 ===");
    console.log(`総ユーザー数: ${users.length}`);
    users.forEach(user => {
      console.log(`- ${user.email} (${user.name}) - Role: ${user.role} - Created: ${user.createdAt.toISOString().split('T')[0]}`);
    });

    // シフト情報を確認
    const shifts = await prisma.shift.findMany({
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10, // 最新10件
    });

    console.log("\n=== シフト情報（最新10件） ===");
    console.log(`総シフト数: ${await prisma.shift.count()}`);
    shifts.forEach(shift => {
      const date = shift.date.toISOString().split('T')[0];
      const startTime = shift.startTime.toTimeString().substring(0, 5);
      const endTime = shift.endTime.toTimeString().substring(0, 5);
      console.log(`- ${shift.user.name} (${shift.user.email}): ${date} ${startTime}-${endTime} [${shift.status}]`);
    });

    // 勤怠情報を確認
    const attendances = await prisma.attendance.findMany({
      select: {
        id: true,
        date: true,
        type: true,
        clockTime: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10, // 最新10件
    });

    console.log("\n=== 勤怠情報（最新10件） ===");
    console.log(`総勤怠記録数: ${await prisma.attendance.count()}`);
    attendances.forEach(attendance => {
      const date = attendance.date.toISOString().split('T')[0];
      const time = attendance.clockTime.toTimeString().substring(0, 5);
      console.log(`- ${attendance.user.name}: ${date} ${time} [${attendance.type}]`);
    });

    // パートナー情報を確認
    const partners = await prisma.partner.findMany({
      select: {
        id: true,
        name: true,
        userIdPrefix: true,
        createdAt: true,
        _count: {
          select: { users: true },
        },
      },
    });

    console.log("\n=== パートナー企業情報 ===");
    console.log(`総パートナー数: ${partners.length}`);
    partners.forEach(partner => {
      console.log(`- ${partner.name} (${partner.userIdPrefix}) - ユーザー数: ${partner._count.users}`);
    });

    // 経費情報を確認
    const expenseCount = await prisma.expense.count();
    console.log(`\n=== その他の情報 ===`);
    console.log(`経費記録数: ${expenseCount}`);

    const commutePassCount = await prisma.commutePass.count();
    console.log(`定期券記録数: ${commutePassCount}`);

  } catch (error) {
    console.error("データ確認エラー:", error);
  }
}

checkAllData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });