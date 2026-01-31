
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateSuperAdminRank() {
    try {
        const roleName = 'SUPER_ADMIN';
        const targetRank = 4;

        console.log(`Updating rank for role: ${roleName} to ${targetRank}...`);

        const role = await prisma.customRole.findUnique({
            where: { name: roleName },
        });

        if (!role) {
            console.error(`Role '${roleName}' not found.`);
            process.exit(1);
        }

        console.log(`Current rank: ${role.rank}`);

        if (role.rank === targetRank) {
            console.log('Rank is already set to 4. No changes needed.');
        } else {
            const updatedRole = await prisma.customRole.update({
                where: { name: roleName },
                data: { rank: targetRank },
            });
            console.log('Update successful:', updatedRole);
        }

    } catch (error) {
        console.error('Error updating rank:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

updateSuperAdminRank();
