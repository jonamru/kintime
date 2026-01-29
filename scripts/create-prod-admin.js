const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createProdAdmin() {
    const email = 'kohei.nagao@alphadoor.jp';
    const password = process.env.ADMIN_PASSWORD || 'default_secure_password'; // Should be provided via env

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check for SUPER_ADMIN role
        let adminRole = await prisma.customRole.findFirst({
            where: { name: 'SUPER_ADMIN' }
        });

        if (!adminRole) {
            console.log('Creating SUPER_ADMIN role...');
            adminRole = await prisma.customRole.create({
                data: {
                    name: 'SUPER_ADMIN',
                    displayName: 'システム管理者',
                    isSystem: true,
                    permissions: {}, // All permissions
                    pageAccess: {} // All access
                }
            });
        }

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                customRoleId: adminRole.id,
                role: 'SUPER_ADMIN',
                isActive: true
            },
            create: {
                email,
                password: hashedPassword,
                name: 'Kohei Nagao',
                userId: 'ADST0000000', // Master ID
                role: 'SUPER_ADMIN',
                customRoleId: adminRole.id,
                isActive: true
            }
        });

        console.log(`Production Admin user created/updated: ${user.email}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

createProdAdmin();
