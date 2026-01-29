const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectAdmin() {
    const email = process.argv[2] || 'kohei.nagao@alphadoor.jp';

    const user = await prisma.user.findUnique({
        where: { email },
        include: { customRole: true }
    });

    if (!user) {
        console.log('User not found');
    } else {
        console.log('User found:', user.name);
        console.log('Role:', user.customRole?.name);
        console.log('Permissions:', JSON.stringify(user.customRole?.permissions, null, 2));
        console.log('PageAccess:', JSON.stringify(user.customRole?.pageAccess, null, 2));
    }

    await prisma.$disconnect();
}

inspectAdmin();
