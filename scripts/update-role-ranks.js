const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRoleRanks() {
    console.log('Updating role ranks...');

    try {
        // 1. Set SUPER_ADMIN to Rank 4 (System Admin)
        const superAdmin = await prisma.customRole.updateMany({
            where: {
                OR: [
                    { name: 'SUPER_ADMIN' },
                    { isSystem: true }
                ]
            },
            data: { rank: 4 }
        });
        console.log(`Updated SUPER_ADMIN rank: ${superAdmin.count} roles`);

        // 2. Set MANAGER_G to Rank 3 (Upper Manager)
        const manager = await prisma.customRole.updateMany({
            where: { name: 'MANAGER_G' },
            data: { rank: 3 }
        });
        console.log(`Updated MANAGER_G rank: ${manager.count} roles`);

        // 3. Set other Managers/Leaders to Rank 2
        // Find roles that might be managers but not SUPER_ADMIN or MANAGER_G
        const allRoles = await prisma.customRole.findMany({
            where: {
                AND: [
                    { name: { not: 'SUPER_ADMIN' } },
                    { name: { not: 'MANAGER_G' } },
                    { isSystem: false }
                ]
            }
        });

        for (const role of allRoles) {
            if (role.name.toUpperCase().includes('MANAGER') ||
                role.name.toUpperCase().includes('LEADER') ||
                role.name.toUpperCase().includes('ADMIN')) {

                await prisma.customRole.update({
                    where: { id: role.id },
                    data: { rank: 2 }
                });
                console.log(`Updated ${role.name} to Rank 2`);
            } else {
                // Default to Rank 1 (Staff)
                await prisma.customRole.update({
                    where: { id: role.id },
                    data: { rank: 1 }
                });
                console.log(`Set ${role.name} to Rank 1 (Default)`);
            }
        }

        console.log('Role rank update completed!');

    } catch (error) {
        console.error('Error updating ranks:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateRoleRanks();
