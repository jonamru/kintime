const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const roleName = 'MANAGER_G';
    const role = await prisma.customRole.findFirst({
        where: { name: roleName },
    });

    if (!role) {
        console.log('Role not found:', roleName);
        return;
    }

    console.log('Found Role:', role.name);
    console.log('Current Page Access:', JSON.stringify(role.pageAccess, null, 2));

    // Update pageAccess
    // Enable adminSystem, adminPartners, and ensure adminSystemSettings remains true
    const newPageAccess = {
        ...(role.pageAccess || {}),
        adminSystemSettings: true,
        adminSystem: true,
        adminPartners: true,
    };

    const updatedRole = await prisma.customRole.update({
        where: { id: role.id },
        data: {
            pageAccess: newPageAccess
        }
    });

    console.log('--------------------------------------------------');
    console.log('Updated Page Access:', JSON.stringify(updatedRole.pageAccess, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
