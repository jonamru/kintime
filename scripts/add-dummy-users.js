const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function addDummyUsers() {
  console.log('ダミーユーザーをデータベースに追加中...');

  try {
    // 既存のパートナー企業を取得
    const existingPartner = await prisma.partner.findFirst({
      where: { name: "サンプル企業" }
    });

    let partner = existingPartner;
    if (!partner) {
      partner = await prisma.partner.create({
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
    }

    // 既存のマネージャーを取得
    const existingManager = await prisma.user.findFirst({
      where: { email: "manager@example.com" }
    });

    let manager = existingManager;
    if (!manager) {
      const managerPassword = await bcrypt.hash("manager123", 10);
      manager = await prisma.user.create({
        data: {
          email: "manager@example.com",
          password: managerPassword,
          name: "田中マネージャー",
          role: "MANAGER",
          userId: "MGR-001",
          partnerId: partner.id,
        },
      });
      console.log("マネージャーを作成:", manager.name);
    }

    const staffPassword = await bcrypt.hash("staff123", 10);

    // 追加のスタッフユーザーを作成（既存チェック付き）
    const additionalStaffs = [
      {
        email: "staff3@example.com",
        name: "高橋スタッフ",
        userId: "STAFF-003",
        partnerId: partner.id,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
      {
        email: "staff4@example.com",
        name: "山田スタッフ",
        userId: "STAFF-004",
        partnerId: partner.id,
        wakeUpEnabled: false,
        departureEnabled: true,
      },
      {
        email: "staff5@example.com",
        name: "伊藤スタッフ",
        userId: "STAFF-005",
        partnerId: partner.id,
        wakeUpEnabled: true,
        departureEnabled: false,
      },
      {
        email: "staff6@example.com",
        name: "渡辺スタッフ",
        userId: "STAFF-006",
        partnerId: partner.id,
        wakeUpEnabled: false,
        departureEnabled: false,
      },
    ];

    for (const staffData of additionalStaffs) {
      const existing = await prisma.user.findUnique({
        where: { email: staffData.email }
      });

      if (!existing) {
        const newStaff = await prisma.user.create({
          data: {
            ...staffData,
            password: staffPassword,
            role: "STAFF",
            managers: {
              connect: { id: manager.id }
            },
          },
        });
        console.log("スタッフユーザーを作成:", newStaff.name);
      } else {
        console.log("既存ユーザーをスキップ:", staffData.name);
      }
    }

    // 新しいパートナー企業を作成
    let partner2 = await prisma.partner.findFirst({
      where: { name: "ABC株式会社" }
    });

    if (!partner2) {
      partner2 = await prisma.partner.create({
        data: {
          name: "ABC株式会社",
          userIdPrefix: "ABC",
          address: "大阪府大阪市中央区",
          phoneNumber: "06-9876-5432",
          email: "info@abc-corp.com",
          contactPerson: "佐藤花子",
        },
      });
      console.log("パートナー企業を作成:", partner2.name);
    }

    // パートナー2のマネージャーを作成
    let manager2 = await prisma.user.findUnique({
      where: { email: "manager2@abc-corp.com" }
    });

    if (!manager2) {
      const managerPassword = await bcrypt.hash("manager123", 10);
      manager2 = await prisma.user.create({
        data: {
          email: "manager2@abc-corp.com",
          password: managerPassword,
          name: "佐藤マネージャー",
          role: "MANAGER",
          userId: "ABC-MGR-001",
          partnerId: partner2.id,
        },
      });
      console.log("パートナー2のマネージャーを作成:", manager2.name);
    }

    // パートナー2のスタッフを作成
    const abcStaffs = [
      {
        email: "staff1@abc-corp.com",
        name: "松本スタッフ",
        userId: "ABC-001",
        partnerId: partner2.id,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
      {
        email: "staff2@abc-corp.com",
        name: "竹内スタッフ",
        userId: "ABC-002",
        partnerId: partner2.id,
        wakeUpEnabled: false,
        departureEnabled: true,
        gpsEnabled: false,
      },
      {
        email: "staff3@abc-corp.com",
        name: "小林スタッフ",
        userId: "ABC-003",
        partnerId: partner2.id,
        wakeUpEnabled: true,
        departureEnabled: false,
      },
    ];

    for (const staffData of abcStaffs) {
      const existing = await prisma.user.findUnique({
        where: { email: staffData.email }
      });

      if (!existing) {
        const newStaff = await prisma.user.create({
          data: {
            ...staffData,
            password: staffPassword,
            role: "STAFF",
            managers: {
              connect: { id: manager2.id }
            },
          },
        });
        console.log("ABC企業スタッフを作成:", newStaff.name);
      } else {
        console.log("既存ユーザーをスキップ:", staffData.name);
      }
    }

    // 第3のパートナー企業を作成
    let partner3 = await prisma.partner.findFirst({
      where: { name: "XYZ商事" }
    });

    if (!partner3) {
      partner3 = await prisma.partner.create({
        data: {
          name: "XYZ商事",
          userIdPrefix: "XYZ",
          address: "愛知県名古屋市中区",
          phoneNumber: "052-1234-5678",
          email: "info@xyz-trading.com",
          contactPerson: "鈴木一郎",
        },
      });
      console.log("パートナー企業を作成:", partner3.name);
    }

    // パートナー3のマネージャーを作成
    let manager3 = await prisma.user.findUnique({
      where: { email: "manager@xyz-trading.com" }
    });

    if (!manager3) {
      const managerPassword = await bcrypt.hash("manager123", 10);
      manager3 = await prisma.user.create({
        data: {
          email: "manager@xyz-trading.com",
          password: managerPassword,
          name: "鈴木マネージャー",
          role: "MANAGER",
          userId: "XYZ-MGR-001",
          partnerId: partner3.id,
        },
      });
      console.log("パートナー3のマネージャーを作成:", manager3.name);
    }

    // パートナー3のスタッフを作成
    const xyzStaffs = [
      {
        email: "staff1@xyz-trading.com",
        name: "青木スタッフ",
        userId: "XYZ-001",
        partnerId: partner3.id,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
      {
        email: "staff2@xyz-trading.com",
        name: "森田スタッフ",
        userId: "XYZ-002",
        partnerId: partner3.id,
        wakeUpEnabled: true,
        departureEnabled: false,
        gpsEnabled: false,
      },
    ];

    for (const staffData of xyzStaffs) {
      const existing = await prisma.user.findUnique({
        where: { email: staffData.email }
      });

      if (!existing) {
        const newStaff = await prisma.user.create({
          data: {
            ...staffData,
            password: staffPassword,
            role: "STAFF",
            managers: {
              connect: { id: manager3.id }
            },
          },
        });
        console.log("XYZ商事スタッフを作成:", newStaff.name);
      } else {
        console.log("既存ユーザーをスキップ:", staffData.name);
      }
    }

    // 自社ユーザー（パートナーなし）を作成
    const internalUsers = [
      {
        email: "internal1@company.com",
        name: "内部太郎",
        userId: "INT-001",
        wakeUpEnabled: true,
        departureEnabled: true,
      },
      {
        email: "internal2@company.com",
        name: "内部花子",
        userId: "INT-002",
        wakeUpEnabled: false,
        departureEnabled: true,
        gpsEnabled: false,
      },
      {
        email: "internal3@company.com",
        name: "内部次郎",
        userId: "INT-003",
        wakeUpEnabled: true,
        departureEnabled: false,
      },
    ];

    for (const userData of internalUsers) {
      const existing = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!existing) {
        const newUser = await prisma.user.create({
          data: {
            ...userData,
            password: staffPassword,
            role: "STAFF",
            // partnerId: null（自社ユーザー）
            managers: {
              connect: { id: manager.id }
            },
          },
        });
        console.log("自社スタッフを作成:", newUser.name);
      } else {
        console.log("既存ユーザーをスキップ:", userData.name);
      }
    }

    console.log("ダミーユーザーの追加が完了しました！");

  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await prisma.$disconnect();
  }
}

addDummyUsers();