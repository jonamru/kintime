const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword() {
    const email = process.argv[2];
    const newPassword = process.argv[3] || 'newpassword123';

    if (!email) {
        console.log('Usage: node scripts/reset-password.js <email> [new_password]');
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const user = await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });
        console.log(`Password reset for user: ${user.email}`);
    } catch (e) {
        console.error('Error resetting password:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
