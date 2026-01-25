import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 自分の経費登録ロック状態を取得
export async function GET(request: Request) {
    try {
        // 認証チェック
        const currentUser = await getCurrentUser(request);
        if (!currentUser) {
            return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || '');
        const month = parseInt(searchParams.get('month') || '');

        if (!year || !month) {
            return NextResponse.json({ error: "年月が指定されていません" }, { status: 400 });
        }

        // デフォルトの経費登録期限（毎月3日）
        const registrationDeadline = 3;

        // ロック状態を取得
        const lockRecord = await prisma.expenseRegistrationLock.findUnique({
            where: {
                userId_year_month: {
                    userId: currentUser.id,
                    year,
                    month,
                }
            }
        });

        // 現在日時と登録期限を計算
        const now = new Date();
        // 期限は翌月3日
        const deadline = new Date(year, month, registrationDeadline, 23, 59, 59);
        const isAfterDeadline = now > deadline;

        // ロック状態チェック（1時間制限の実装）
        let isRecordUnlocked = lockRecord?.isUnlocked || false;

        if (lockRecord && lockRecord.isUnlocked && lockRecord.unlockedAt) {
            const unlockTime = new Date(lockRecord.unlockedAt);
            const autoLockTime = new Date(unlockTime.getTime() + 60 * 60 * 1000); // 1時間後

            if (now >= autoLockTime) {
                // 1時間経過している場合は自動でロック
                await prisma.expenseRegistrationLock.update({
                    where: { id: lockRecord.id },
                    data: { isUnlocked: false }
                });
                isRecordUnlocked = false;
            }
        }

        // 期限切れ かつ (ロックレコードがない OR ロック解除されていない) 場合にロック
        const isLocked = isAfterDeadline && !isRecordUnlocked;
        const isUnlocked = isRecordUnlocked;

        return NextResponse.json({
            isLocked,
            isUnlocked,
            deadline: deadline.toISOString(),
            isAfterDeadline,
        });
    } catch (error: unknown) {
        console.error("ロック状態取得エラー:", error);
        return NextResponse.json(
            { error: "ロック状態の取得に失敗しました" },
            { status: 500 }
        );
    }
}
