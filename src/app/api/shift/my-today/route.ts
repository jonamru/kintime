import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getJapanTodayString, getJapanDayRange } from "@/lib/dateUtils";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 日本時間で今日の日付範囲を取得
    const todayString = getJapanTodayString();
    const { startOfDay, endOfDay } = getJapanDayRange(todayString);
    console.log("ダッシュボード - 今日の日付文字列（日本時間）:", todayString);

    // 今日のシフトを取得（日本時間基準）
    const todayShift = await prisma.shift.findFirst({
      where: {
        userId: currentUser.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: "APPROVED",
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        shiftType: true,
        location: true,
      },
    });

    console.log("ダッシュボード - 見つかったシフト:", todayShift);
    
    return NextResponse.json({
      hasShift: !!todayShift,
      shift: todayShift,
      date: todayString,
    });
  } catch (error) {
    console.error("今日のシフト取得エラー:", error);
    return NextResponse.json(
      { error: "今日のシフト情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}