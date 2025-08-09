import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexedに変換

    // 現在月の解除記録を取得
    const unlockRecord = await prisma.shiftRegistrationLock.findUnique({
      where: {
        userId_year_month: {
          userId: currentUser.id,
          year: currentYear,
          month: currentMonth,
        }
      }
    });

    let isUnlocked = false;
    let remainingTime = 0;

    if (unlockRecord && unlockRecord.isUnlocked && unlockRecord.unlockedAt) {
      const unlockTime = new Date(unlockRecord.unlockedAt);
      const lockTime = new Date(unlockTime.getTime() + 60 * 60 * 1000); // 1時間後
      
      if (now < lockTime) {
        isUnlocked = true;
        remainingTime = Math.ceil((lockTime.getTime() - now.getTime()) / 1000); // 残り秒数
      } else {
        // 1時間経過している場合は自動でロック
        await prisma.shiftRegistrationLock.update({
          where: { id: unlockRecord.id },
          data: { isUnlocked: false }
        });
        isUnlocked = false;
      }
    }

    return NextResponse.json({
      isUnlocked,
      remainingTime,
      year: currentYear,
      month: currentMonth
    });
  } catch (error) {
    console.error("ロック解除状態取得エラー:", error);
    return NextResponse.json(
      { error: "状態の取得に失敗しました" },
      { status: 500 }
    );
  }
}