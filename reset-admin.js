const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const password = 'password';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
        where: { email: 'admin@example.com' },
        data: { password: hashedPassword }
    });

    console.log(`Password reset for ${user.email} to '${password}'`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
