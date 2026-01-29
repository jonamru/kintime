const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simplifyRoles() {
    console.log('Simplifying roles...');

    // Create or update standard roles
    const roles = [
        {
            name: 'SUPER_ADMIN',
            displayName: 'システム管理者',
            isSystem: true,
            permissions: {
                userManagement: { level: 'admin', scope: 'all' },
                shiftManagement: { level: 'admin', scope: 'all' },
                attendanceManagement: { level: 'admin', scope: 'all' },
                expenseManagement: { level: 'admin', scope: 'all' },
                systemSettings: { level: 'admin' },
            },
            pageAccess: {
                dashboard: true,
                adminUsers: true,
                adminPartners: true,
                adminSystem: true,
                // ... (all true)
            }
        },
        {
            name: 'STAFF',
            displayName: 'スタッフ',
            isSystem: false,
            permissions: {
                userManagement: { level: 'none', scope: 'self' },
                shiftManagement: { level: 'view', scope: 'self' },
                attendanceManagement: { level: 'view', scope: 'self' },
                expenseManagement: { level: 'edit', scope: 'self' },
                systemSettings: { level: 'none' },
            },
            pageAccess: {
                dashboard: true,
                attendance: true,
                attendanceHistory: true,
                shiftRequest: true,
                expense: true,
                // ... others false
            }
        }
    ];

    for (const role of roles) {
        const upserted = await prisma.customRole.upsert({
            where: { name: role.name },
            update: role,
            create: role
        });
        console.log(`Role upserted: ${upserted.name}`);
    }

    await prisma.$disconnect();
}

simplifyRoles();
