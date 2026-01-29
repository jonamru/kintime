const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
    try {
        const users = await prisma.user.findMany({
            include: {
                customRole: true,
                partner: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log('=== User List ===');
        console.table(users.map(u => ({
            userId: u.userId,
            email: u.email,
            name: u.name,
            roleName: u.customRole?.name || 'N/A',
            roleDisplay: u.customRole?.displayName || 'N/A',
            partner: u.partner?.name || 'Self'
        })));

        const roles = await prisma.customRole.findMany();
        console.log('\n=== Role List ===');
        console.table(roles.map(r => ({
            id: r.id,
            name: r.name,
            display: r.displayName,
            isSystem: r.isSystem
        })));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();
