import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// ユーザーのシフト登録ロック状態を取得
export async function GET(request: Request) {
  try {
    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // シフトロック解除権限をチェック
    const hasLockUnlockPermission = await hasPermission(currentUser.id, "shiftManagement", "lockUnlock");
    if (!hasLockUnlockPermission) {
      return NextResponse.json({ error: "シフトロック管理権限がありません" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '');
    const month = parseInt(searchParams.get('month') || '');
    
    if (!year || !month) {
      return NextResponse.json({ error: "年月が指定されていません" }, { status: 400 });
    }

    // システム設定を取得（デフォルト値を使用）
    const registrationDeadline = 3; // デフォルトのシフト登録期限

    // 全ユーザーとそのロック状態を取得
    const users = await prisma.user.findMany({
      include: {
        shiftRegistrationLocks: {
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
    const deadline = new Date(year, month - 1, registrationDeadline, 23, 59, 59);
    const isAfterDeadline = now > deadline;

    const result = users.map(user => {
      const lockRecord = user.shiftRegistrationLocks[0];
      return {
        userId: user.id,
        userName: user.name,
        email: user.email,
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
  } catch (error) {
    console.error("ロック状態取得エラー:", error);
    return NextResponse.json(
      { error: "ロック状態の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// ユーザーのシフト登録ロックを解除
export async function POST(request: Request) {
  try {
    const { userId, year, month, action } = await request.json();

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // シフトロック解除権限をチェック
    const hasLockUnlockPermission = await hasPermission(currentUser.id, "shiftManagement", "lockUnlock");
    if (!hasLockUnlockPermission) {
      return NextResponse.json({ error: "シフトロック操作権限がありません" }, { status: 403 });
    }

    if (!userId || !year || !month || !action) {
      return NextResponse.json({ error: "必要なパラメータが不足しています" }, { status: 400 });
    }

    if (action === 'unlock') {
      // ロック解除
      await prisma.shiftRegistrationLock.upsert({
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
      await prisma.shiftRegistrationLock.upsert({
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
  } catch (error) {
    console.error("ロック操作エラー:", error);
    return NextResponse.json(
      { error: "ロック操作に失敗しました" },
      { status: 500 }
    );
  }
}