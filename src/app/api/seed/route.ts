import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 関連データを正しい順序で削除（外部キー制約を考慮）
    await prisma.attendance.deleteMany({});
    await prisma.shiftRequest.deleteMany({});
    await prisma.shift.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.commutePass.deleteMany({});
    await prisma.correction.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.partner.deleteMany({});

    // パートナー企業を作成
    const partner1 = await prisma.partner.create({
      data: {
        name: "パートナー企業A",
        userIdPrefix: "PA",
      },
    });

    // カスタムロールを作成
    await prisma.customRole.deleteMany({});

    // システム管理者ロール
    const superAdminRole = await prisma.customRole.create({
      data: {
        name: "SUPER_ADMIN",
        displayName: "システム管理者",
        isSystem: true,
        permissions: {
          userManagement: { create: true, edit: true, delete: true, viewAll: true, viewAssigned: true, editAssigned: true },
          shiftManagement: { approve: true, edit: true, delete: true, viewAll: true, forceRegister: true, lockUnlock: true, viewAssigned: true, editAssigned: true },
          attendanceManagement: { viewAll: true, forceClockInOut: true, editOthers: true, viewAssigned: true, editAssigned: true },
          expenseManagement: { approve: true, viewAll: true, lock: true, viewAssigned: true, editAssigned: true },
          systemSettings: { manageCompany: true, manageRoles: true, managePartners: true },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: true, shiftOverview: true, shiftRegister: true, shiftLock: true,
          expense: true, expenseMonthly: true, adminUsers: true, adminPartners: true,
          adminSystemSettings: true, adminSystem: true,
        },
      },
    });

    // 管理者ロール
    const managerRole = await prisma.customRole.create({
      data: {
        name: "MANAGER",
        displayName: "管理者",
        isSystem: true,
        permissions: {
          userManagement: { create: true, edit: true, delete: true, viewAll: true, viewAssigned: true, editAssigned: true },
          shiftManagement: { approve: true, edit: true, delete: true, viewAll: true, forceRegister: true, lockUnlock: true, viewAssigned: true, editAssigned: true },
          attendanceManagement: { viewAll: true, forceClockInOut: true, editOthers: true, viewAssigned: true, editAssigned: true },
          expenseManagement: { approve: true, viewAll: true, lock: true, viewAssigned: true, editAssigned: true },
          systemSettings: { manageCompany: false, manageRoles: false, managePartners: false },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: true, shiftOverview: true, shiftRegister: true, shiftLock: true,
          expense: true, expenseMonthly: true, adminUsers: true, adminPartners: false,
          adminSystemSettings: false, adminSystem: false,
        },
      },
    });

    // パートナー管理者ロール
    const partnerManagerRole = await prisma.customRole.create({
      data: {
        name: "PARTNER_MANAGER",
        displayName: "パートナー管理者",
        isSystem: true,
        permissions: {
          userManagement: { create: false, edit: false, delete: false, viewAll: false, viewAssigned: true, editAssigned: false },
          shiftManagement: { approve: false, edit: true, delete: false, viewAll: true, forceRegister: false, lockUnlock: false, viewAssigned: true, editAssigned: true },
          attendanceManagement: { viewAll: true, forceClockInOut: false, editOthers: false, viewAssigned: true, editAssigned: false },
          expenseManagement: { approve: false, viewAll: false, lock: false, viewAssigned: true, editAssigned: false },
          systemSettings: { manageCompany: false, manageRoles: false, managePartners: false },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: true, shiftOverview: true, shiftRegister: false, shiftLock: false,
          expense: false, expenseMonthly: false, adminUsers: false, adminPartners: false,
          adminSystemSettings: false, adminSystem: false,
        },
      },
    });

    // スタッフロール
    const staffRole = await prisma.customRole.create({
      data: {
        name: "STAFF",
        displayName: "スタッフ",
        isSystem: true,
        permissions: {
          userManagement: { create: false, edit: false, delete: false, viewAll: false, viewAssigned: false, editAssigned: false },
          shiftManagement: { approve: false, edit: false, delete: false, viewAll: false, forceRegister: false, lockUnlock: false, viewAssigned: false, editAssigned: false },
          attendanceManagement: { viewAll: false, forceClockInOut: false, editOthers: false, viewAssigned: false, editAssigned: false },
          expenseManagement: { approve: false, viewAll: false, lock: false, viewAssigned: false, editAssigned: false },
          systemSettings: { manageCompany: false, manageRoles: false, managePartners: false },
        },
        pageAccess: {
          dashboard: true, attendance: true, attendanceHistory: true, shiftRequest: true,
          shiftWorkers: false, shiftOverview: false, shiftRegister: false, shiftLock: false,
          expense: true, expenseMonthly: false, adminUsers: false, adminPartners: false,
          adminSystemSettings: false, adminSystem: false,
        },
      },
    });

    // 初期ユーザーを作成（一時的にパスワードはそのまま保存）
    const hashedPassword = "password123"; // 本来はbcryptでハッシュ化

    // 全権管理者
    const superAdmin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        password: hashedPassword,
        name: "システム管理者",
        customRoleId: superAdminRole.id,
        gpsEnabled: true,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
    });

    // 担当別管理者
    const manager = await prisma.user.create({
      data: {
        email: "manager@example.com",
        password: hashedPassword,
        name: "山田太郎",
        customRoleId: managerRole.id,
        gpsEnabled: true,
        wakeUpEnabled: false,
        departureEnabled: true,
      },
    });

    // パートナー企業管理者
    const partnerManager = await prisma.user.create({
      data: {
        email: "partner@example.com",
        password: hashedPassword,
        name: "パートナー管理者",
        customRoleId: partnerManagerRole.id,
        partnerId: partner1.id,
        gpsEnabled: true,
        wakeUpEnabled: false,
        departureEnabled: false,
      },
    });

    // 自社スタッフ
    const staff = await prisma.user.create({
      data: {
        email: "staff@example.com",
        password: hashedPassword,
        name: "鈴木花子",
        customRoleId: staffRole.id,
        managerId: manager.id,
        gpsEnabled: false,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
    });

    // パートナースタッフ
    const partnerStaff = await prisma.user.create({
      data: {
        email: "partnerstaff@example.com",
        password: hashedPassword,
        name: "佐藤次郎",
        customRoleId: staffRole.id,
        partnerId: partner1.id,
        managerId: partnerManager.id,
        gpsEnabled: true,
        wakeUpEnabled: false,
        departureEnabled: false,
      },
    });

    // サンプルプロジェクトを作成
    const project1 = await prisma.project.create({
      data: {
        name: "携帯販売キャンペーン",
        client: "大手通信会社",
        location: "大阪駅前",
        description: "新機種発売キャンペーンの販売スタッフ",
        contractPrice: 15000,
        paymentPrice: 12000,
      },
    });

    const project2 = await prisma.project.create({
      data: {
        name: "展示会イベント",
        client: "メーカーA",
        location: "インテックス大阪",
        description: "商品展示会でのコンパニオン業務",
        contractPrice: 20000,
        paymentPrice: 16000,
      },
    });

    return NextResponse.json({
      message: "初期データの作成に成功しました",
      users: [
        { email: "admin@example.com", password: "password123", role: "全権管理者" },
        { email: "manager@example.com", password: "password123", role: "担当別管理者" },
        { email: "partner@example.com", password: "password123", role: "パートナー企業管理者" },
        { email: "staff@example.com", password: "password123", role: "自社スタッフ" },
        { email: "partnerstaff@example.com", password: "password123", role: "パートナースタッフ" },
      ],
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { 
        error: "初期データの作成に失敗しました", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}