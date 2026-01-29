const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRoles() {
    const users = await prisma.user.findMany({
        include: { customRole: true }
    });

    console.log('=== Role Verification ===');
    users.forEach(u => {
        console.log(`${u.email}: ${u.customRole ? u.customRole.name : 'NO_ROLE'}`);
    });

    await prisma.$disconnect();
}

verifyRoles();
