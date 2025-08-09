const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 データベース初期化を開始します...');

  try {
    // 既存のデータがある場合は実行を停止
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log('⚠️ データベースには既にデータが存在します。初期化は実行されません。');
      console.log(`現在のユーザー数: ${userCount}`);
      return;
    }

    // 確認プロンプト
    console.log('⚠️ この操作により全てのデータが削除され、初期データが作成されます。');
    console.log('開発環境でのみ実行してください。');
    
    // 関連データを正しい順序で削除（外部キー制約を考慮）
    console.log('🗑️ 既存データを削除中...');
    await prisma.attendance.deleteMany({});
    await prisma.shiftRequest.deleteMany({});
    await prisma.shift.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.commutePass.deleteMany({});
    await prisma.correction.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.partner.deleteMany({});
    await prisma.customRole.deleteMany({});

    // パートナー企業を作成
    console.log('🏢 パートナー企業を作成中...');
    const partner1 = await prisma.partner.create({
      data: {
        name: "パートナー企業A",
        userIdPrefix: "PA",
      },
    });

    // カスタムロールを作成
    console.log('👥 カスタムロールを作成中...');
    
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

    // パスワードをハッシュ化
    console.log('🔐 パスワードをハッシュ化中...');
    const hashedPassword = await bcrypt.hash("password123", 10);

    // 初期ユーザーを作成
    console.log('👤 初期ユーザーを作成中...');
    
    const superAdmin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        password: hashedPassword,
        name: "システム管理者",
        customRoleId: superAdminRole.id,
        role: "SUPER_ADMIN",
        gpsEnabled: true,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        email: "manager@example.com",
        password: hashedPassword,
        name: "山田太郎",
        customRoleId: managerRole.id,
        role: "MANAGER",
        gpsEnabled: true,
        wakeUpEnabled: false,
        departureEnabled: true,
      },
    });

    const staff = await prisma.user.create({
      data: {
        email: "staff@example.com",
        password: hashedPassword,
        name: "鈴木花子",
        customRoleId: staffRole.id,
        role: "STAFF",
        gpsEnabled: false,
        wakeUpEnabled: true,
        departureEnabled: true,
      },
    });

    // サンプルプロジェクトを作成
    console.log('📁 サンプルプロジェクトを作成中...');
    await prisma.project.createMany({
      data: [
        {
          name: "携帯販売キャンペーン",
          client: "大手通信会社",
          location: "大阪駅前",
          description: "新機種発売キャンペーンの販売スタッフ",
          contractPrice: 15000,
          paymentPrice: 12000,
        },
        {
          name: "展示会イベント",
          client: "メーカーA",
          location: "インテックス大阪",
          description: "商品展示会でのコンパニオン業務",
          contractPrice: 20000,
          paymentPrice: 16000,
        },
      ],
    });

    console.log('✅ 初期データの作成が完了しました！');
    console.log('\n📋 作成されたユーザー:');
    console.log('- admin@example.com (システム管理者) - password: password123');
    console.log('- manager@example.com (管理者) - password: password123');
    console.log('- staff@example.com (スタッフ) - password: password123');
    console.log('\n🔐 本番環境では必ずパスワードを変更してください！');

  } catch (error) {
    console.error('❌ 初期データ作成中にエラーが発生しました:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });