const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testExpenseCreation() {
  try {
    console.log('経費申請作成テスト...');
    
    const user = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });
    
    if (!user) {
      console.error('ユーザーが見つかりません');
      return;
    }
    
    console.log('ユーザー確認OK:', user.id);
    
    // テスト用経費申請データ
    const testData = {
      userId: user.id,
      date: new Date('2025-07-24'),
      type: 'TRANSPORT',
      amount: 240.0,
      description: 'テスト経路詳細',
      departure: '寝屋川公園',
      arrival: '松井山手',
      route: 'ＪＲ学研都市線区間快速',
      referenceUrl: 'https://yahoo.jp/test',
      status: 'PENDING',
    };
    
    console.log('作成データ:', testData);
    
    const expense = await prisma.expense.create({
      data: testData
    });
    
    console.log('経費申請作成成功:', expense);
    
  } catch (error) {
    console.error('経費申請作成エラー:', error);
    console.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      meta: error.meta,
      stack: error.stack
    });
  } finally {
    await prisma.$disconnect();
  }
}

testExpenseCreation();