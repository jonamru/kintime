const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:@localhost:3306/kintime_db"
    }
  }
});

async function main() {
  // bcryptではなくbcryptjsで再ハッシュ
  const hashedPassword = await bcrypt.hash('admin123', 10);
  console.log('New hashed password:', hashedPassword);
  
  try {
    const admin = await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: {
        password: hashedPassword,
      },
    });
    console.log('Admin password updated:', admin.email);
    
    // パスワード検証テスト
    const isValid = await bcrypt.compare('admin123', hashedPassword);
    console.log('Password validation test:', isValid);
  } catch (error) {
    console.error('Error updating admin:', error);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
