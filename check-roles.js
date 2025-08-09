const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoles() {
  try {
    const roles = await prisma.customRole.findMany({
      where: { name: 'SUPER_ADMIN' }
    });
    console.log('SUPER_ADMIN role:');
    console.log(JSON.stringify(roles, null, 2));
    
    const users = await prisma.user.findMany({
      include: { customRole: true },
      where: { customRoleId: roles[0]?.id }
    });
    console.log('\nUsers with SUPER_ADMIN role:');
    console.log(JSON.stringify(users.map(u => ({ 
      id: u.id, 
      name: u.name, 
      employeeId: u.employeeId,
      roleName: u.customRole?.name,
      pageAccess: u.customRole?.pageAccess
    })), null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoles();