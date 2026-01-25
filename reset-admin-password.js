const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2] || 'admin@example.com';
    const newPassword = process.argv[3] || 'admin123';

    console.log(`パスワードをリセットします...`);
    console.log(`対象ユーザー: ${email}`);
    console.log(`新しいパスワード: ${newPassword}`);

    // bcryptで新しいハッシュを生成
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ユーザーを更新
    const updated = await prisma.user.update({
        where: { email: email },
        data: { password: hashedPassword }
    });

    console.log('\n✅ パスワードのリセットが完了しました！');
    console.log(`ユーザー: ${updated.email}`);
    console.log(`名前: ${updated.name}`);
    console.log(`\n以下の情報でログインできます:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
}

main()
    .catch((error) => {
        console.error('❌ エラーが発生しました:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
