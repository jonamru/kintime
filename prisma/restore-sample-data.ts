import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function restoreSampleData() {
  console.log("サンプルデータを復旧中...");

  try {
    // パートナー企業を作成
    const partner = await prisma.partner.create({
      data: {
        name: "サンプル企業",
        userIdPrefix: "SAMP",
        address: "東京都渋谷区",
        phoneNumber: "03-1234-5678",
        email: "info@sample.com",
        contactPerson: "田中太郎",
      },
    });
    console.log("パートナー企業を作成:", partner.name);

    // 管理者ユーザー（既存の場合はスキップ）
    const existingAdmin = await prisma.user.findUnique({
      where: { email: "admin@example.com" },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await prisma.user.create({
        data: {
          email: "admin@example.com",
          password: hashedPassword,
          name: "システム管理者",
          role: "SUPER_ADMIN",
          userId: "ADMIN-001",
        },
      });
      console.log("管理者ユーザーを作成");
    }

    // マネージャーユーザーを作成
    const managerPassword = await bcrypt.hash("manager123", 10);
    const manager = await prisma.user.create({
      data: {
        email: "manager@example.com",
        password: managerPassword,
        name: "田中マネージャー",
        role: "MANAGER",
        userId: "MGR-001",
        partnerId: partner.id,
      },
    });
    console.log("マネージャーユーザーを作成:", manager.name);

    // スタッフユーザーを作成
    const staffPassword = await bcrypt.hash("staff123", 10);
    const staff1 = await prisma.user.create({
      data: {
        email: "staff1@example.com",
        password: staffPassword,
        name: "佐藤スタッフ",
        role: "STAFF",
        userId: "STAFF-001",
        partnerId: partner.id,
        managers: {
          connect: { id: manager.id }
        },
        wakeUpEnabled: true,
        departureEnabled: true,
      },
    });
    console.log("スタッフユーザーを作成:", staff1.name);

    const staff2 = await prisma.user.create({
      data: {
        email: "staff2@example.com",
        password: staffPassword,
        name: "鈴木スタッフ",
        role: "STAFF",
        userId: "STAFF-002",
        partnerId: partner.id,
        managers: {
          connect: { id: manager.id }
        },
        gpsEnabled: false,
      },
    });
    console.log("スタッフユーザーを作成:", staff2.name);

    // サンプルシフトを作成（今週分）
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // 月曜日

    for (let i = 0; i < 5; i++) { // 月〜金
      const shiftDate = new Date(startOfWeek);
      shiftDate.setDate(startOfWeek.getDate() + i);
      
      const startTime = new Date(shiftDate);
      startTime.setHours(9, 0, 0, 0);
      
      const endTime = new Date(shiftDate);
      endTime.setHours(18, 0, 0, 0);

      // staff1のシフト
      await prisma.shift.create({
        data: {
          userId: staff1.id,
          date: shiftDate,
          startTime: startTime,
          endTime: endTime,
          shiftType: "REGULAR",
          location: "東京オフィス",
          status: "APPROVED",
          breakTime: 60,
        },
      });

      // staff2のシフト（隔日）
      if (i % 2 === 0) {
        await prisma.shift.create({
          data: {
            userId: staff2.id,
            date: shiftDate,
            startTime: startTime,
            endTime: endTime,
            shiftType: "REGULAR",
            location: "大阪オフィス",
            status: "APPROVED",
            breakTime: 60,
          },
        });
      }
    }
    console.log("今週のシフトを作成");

    // サンプル勤怠記録を作成（昨日と今日）
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // 昨日の勤怠（staff1）
    const yesterdayClockIn = new Date(yesterday);
    yesterdayClockIn.setHours(9, 5, 0, 0);
    
    const yesterdayClockOut = new Date(yesterday);
    yesterdayClockOut.setHours(18, 15, 0, 0);

    await prisma.attendance.create({
      data: {
        userId: staff1.id,
        date: yesterdayClockIn,
        type: "CLOCK_IN",
        clockTime: yesterdayClockIn,
        latitude: 35.6762,
        longitude: 139.6503,
      },
    });

    await prisma.attendance.create({
      data: {
        userId: staff1.id,
        date: yesterdayClockOut,
        type: "CLOCK_OUT",
        clockTime: yesterdayClockOut,
        latitude: 35.6762,
        longitude: 139.6503,
      },
    });
    console.log("昨日の勤怠記録を作成");

    // サンプル経費を作成
    await prisma.expense.create({
      data: {
        userId: staff1.id,
        date: yesterday,
        type: "TRANSPORT",
        amount: 500,
        description: "東京駅→品川駅",
        departure: "東京駅",
        arrival: "品川駅",
        status: "PENDING",
        tripType: "ROUND_TRIP",
      },
    });
    console.log("サンプル経費を作成");

    console.log("\n=== 復旧完了 ===");
    console.log("ログイン情報:");
    console.log("- 管理者: admin@example.com / admin123");
    console.log("- マネージャー: manager@example.com / manager123");
    console.log("- スタッフ1: staff1@example.com / staff123");
    console.log("- スタッフ2: staff2@example.com / staff123");

  } catch (error) {
    console.error("復旧エラー:", error);
  }
}

restoreSampleData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });