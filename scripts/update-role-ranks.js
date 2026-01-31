import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateRoleRanks() {
    try {
        console.log("開始: ロールランク更新");

        const roleDefinitions = [
            { name: "SUPER_ADMIN", rank: 4 }, // システム管理者
            { name: "MANAGER", rank: 2 },     // 管理者
            { name: "PARTNER_MANAGER", rank: 1 }, // パートナー管理者/リーダー
            { name: "STAFF", rank: 0 },       // スタッフ
            { name: "PARTNER_STAFF", rank: 0 }, // パートナースタッフ
        ];

        for (const def of roleDefinitions) {
            const role = await prisma.customRole.findUnique({
                where: { name: def.name },
            });

            if (role) {
                await prisma.customRole.update({
                    where: { id: role.id },
                    data: { rank: def.rank },
                });
                console.log(`✓ ${def.name} のランクを ${def.rank} に更新しました`);
            } else {
                console.warn(`⚠ ${def.name} が見つかりませんでした`);
            }
        }

        console.log("✅ ロールランク更新完了");
    } catch (error) {
        console.error("❌ エラーが発生しました:", error);
    } finally {
        await prisma.$disconnect();
    }
}

updateRoleRanks();
