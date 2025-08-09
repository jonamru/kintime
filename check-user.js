const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('データベース接続テスト...');
    
    // admin@example.comユーザーの確認
    const user = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });
    
    console.log('admin@example.comユーザー:', user);
    
    // 全ユーザー数の確認
    const userCount = await prisma.user.count();
    console.log('総ユーザー数:', userCount);
    
    // Expenseテーブルの確認
    const expenseCount = await prisma.expense.count();
    console.log('総経費申請数:', expenseCount);
    
    // 最新の経費申請5件
    const recentExpenses = await prisma.expense.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, name: true } } }
    });
    console.log('最新の経費申請:', recentExpenses);
    
  } catch (error) {
    console.error('データベースエラー:', error);
    console.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      meta: error.meta
    });
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();