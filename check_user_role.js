const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const roleName = 'SALES'; // Target Role Name
    const role = await prisma.customRole.findFirst({
        where: { name: roleName },
    });

    if (!role) {
        console.log('Role not found:', roleName);
        return;
    }

    console.log('--------------------------------------------------');
    console.log('Role Name:', role.name);
    console.log('Permissions JSON:', JSON.stringify(role.permissions, null, 2));
    console.log('--------------------------------------------------');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
