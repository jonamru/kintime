import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// ユーザーの経費登録ロック状態を取得
export async function GET(request: Request) {
    try {
        // 認証チェック
        const currentUser = await getCurrentUser(request);
        if (!currentUser) {
            return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
        }

        // 経費ロック解除権限をチェック (シフトロック権限または経費管理権限)
        const hasLockUnlockPermission = await hasPermission(currentUser.id, "expenseManagement", "lock") ||
            await hasPermission(currentUser.id, "systemSettings", "manageCompany");

        // permissions.tsにはexpenseManagement.lockという権限があるか確認
        // type PermissionsにはexpenseManagement: { lock: boolean }がある

        if (!hasLockUnlockPermission) {
            return NextResponse.json({ error: "経費ロック管理権限がありません" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || '');
        const month = parseInt(searchParams.get('month') || '');

        if (!year || !month) {
            return NextResponse.json({ error: "年月が指定されていません" }, { status: 400 });
        }

        // デフォルトの経費登録期限（毎月3日）
        const registrationDeadline = 3;

        // 自動ロック処理: 解除から1時間経過したものをロックに戻す
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        await prisma.expenseRegistrationLock.updateMany({
            where: {
                year,
                month,
                isUnlocked: true,
                unlockedAt: {
                    lt: oneHourAgo
                }
            },
            data: {
                isUnlocked: false
            }
        });

        // 全ユーザーとそのロック状態を取得
        const users = await prisma.user.findMany({
            include: {
                expenseRegistrationLocks: {
                    where: {
                        year,
                        month,
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        // 現在日時と登録期限を計算
        const now = new Date();
        // 期限は翌月3日。
        // APIで指定されたyear/monthが「対象月」。
        // 締め切りは「対象月の翌月3日」。
        // 例: 対象が1月 => 締め切りは2月3日 23:59:59
        const deadline = new Date(year, month, registrationDeadline, 23, 59, 59);
        // month is 0-indexed in JS Date? 
        // Wait, prisma stores 1-indexed month? 
        // Usually standard is 1-indexed for business logic, but JS Date constructor uses 0-indexed month.
        // If year=2024, month=1 (January).
        // Deadline is Feb 3rd.
        // new Date(2024, 1, 3) -> Feb 3rd. (Month is index 1 = Feb).
        // So if month parameter is 1-based, we pass it directly to Date constructor to get "Next Month".

        const isAfterDeadline = now > deadline;

        const result = users.map(user => {
            const lockRecord = user.expenseRegistrationLocks[0];
            return {
                userId: user.id,
                userName: user.name,
                email: user.email,
                // 期限切れ かつ (ロックレコードがない OR ロックレコードがunlockではない) 場合にロック
                isLocked: isAfterDeadline && (!lockRecord || !lockRecord.isUnlocked),
                isUnlocked: lockRecord?.isUnlocked || false,
                unlockedBy: lockRecord?.unlockedBy,
                unlockedAt: lockRecord?.unlockedAt,
            };
        });

        return NextResponse.json({
            users: result,
            deadline: deadline.toISOString(),
            isAfterDeadline,
            registrationDeadline: registrationDeadline,
        });
    } catch (error: unknown) {
        console.error("ロック状態取得エラー:", error);
        return NextResponse.json(
            { error: "ロック状態の取得に失敗しました" },
            { status: 500 }
        );
    }
}

// ユーザーの経費登録ロックを解除
export async function POST(request: Request) {
    try {
        const { userId, year, month, action } = await request.json();

        // 認証チェック
        const currentUser = await getCurrentUser(request);
        if (!currentUser) {
            return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
        }

        // 経費ロック解除権限をチェック
        const hasLockUnlockPermission = await hasPermission(currentUser.id, "expenseManagement", "lock") ||
            await hasPermission(currentUser.id, "systemSettings", "manageCompany");

        if (!hasLockUnlockPermission) {
            return NextResponse.json({ error: "経費ロック操作権限がありません" }, { status: 403 });
        }

        if (!userId || !year || !month || !action) {
            return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
        }

        if (action === 'unlock') {
            // ロック解除
            await prisma.expenseRegistrationLock.upsert({
                where: {
                    userId_year_month: {
                        userId,
                        year,
                        month,
                    }
                },
                update: {
                    isUnlocked: true,
                    unlockedBy: currentUser.id,
                    unlockedAt: new Date(),
                },
                create: {
                    userId,
                    year,
                    month,
                    isUnlocked: true,
                    unlockedBy: currentUser.id,
                    unlockedAt: new Date(),
                }
            });

            return NextResponse.json({
                message: "ロックを解除しました",
                success: true
            });
        } else if (action === 'lock') {
            // ロック再設定
            await prisma.expenseRegistrationLock.upsert({
                where: {
                    userId_year_month: {
                        userId,
                        year,
                        month,
                    }
                },
                update: {
                    isUnlocked: false,
                    unlockedBy: null,
                    unlockedAt: null,
                },
                create: {
                    userId,
                    year,
                    month,
                    isUnlocked: false,
                }
            });

            return NextResponse.json({
                message: "ロックを再設定しました",
                success: true
            });
        } else {
            return NextResponse.json({ error: "無効なアクションです" }, { status: 400 });
        }
    } catch (error: unknown) {
        console.error("ロック操作エラー:", error);
        return NextResponse.json(
            { error: "ロック操作に失敗しました" },
            { status: 500 }
        );
    }
}
