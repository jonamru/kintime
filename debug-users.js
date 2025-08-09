const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        customRole: {
          select: {
            name: true,
            displayName: true
          }
        }
      },
      take: 5
    });
    
    console.log('First 5 users in database:');
    console.log(JSON.stringify(users, null, 2));
    
    const currentUser = await prisma.user.findFirst({
      where: {
        customRole: {
          name: 'SUPER_ADMIN'
        }
      },
      select: {
        id: true,
        userId: true,
        name: true,
        email: true
      }
    });
    
    console.log('\nFirst SUPER_ADMIN user:');
    console.log(JSON.stringify(currentUser, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUsers();