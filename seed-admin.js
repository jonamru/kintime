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
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  try {
    const admin = await prisma.user.create({
      data: {
        userId: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        name: '管理者',
        role: 'SUPER_ADMIN',
        birthDate: new Date('1990-01-01'),
      },
    });
    console.log('Admin user created:', admin);
  } catch (error) {
    console.error('Error creating admin:', error);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
