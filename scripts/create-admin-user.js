const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdminUser() {
    const email = 'admin@example.com';
    const password = process.argv[2] || 'admin123';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check for SUPER_ADMIN role
        const adminRole = await prisma.customRole.findFirst({
            where: { name: 'SUPER_ADMIN' }
        });

        if (!adminRole) {
            console.error('SUPER_ADMIN role not found. Please run seed script first.');
            return;
        }

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                customRoleId: adminRole.id,
                role: 'SUPER_ADMIN' // Deprecated but kept for compatibility
            },
            create: {
                email,
                password: hashedPassword,
                name: 'System Admin',
                userId: 'ADST0000001',
                role: 'SUPER_ADMIN',
                customRoleId: adminRole.id
            }
        });

        console.log(`Admin user created/updated: ${user.email}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

createAdminUser();
