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
    console.log("今日の勤怠取得 - 日付文字列（日本時間）:", todayString);

    // 今日の勤怠記録を取得
    const todayAttendance = await prisma.attendance.findMany({
      where: {
        userId: currentUser.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        clockTime: 'asc',
      },
      select: {
        id: true,
        type: true,
        clockTime: true,
        date: true,
      },
    });

    console.log(`今日の勤怠記録数: ${todayAttendance.length}`);
    console.log("勤怠記録:", todayAttendance);
    
    return NextResponse.json({
      attendance: todayAttendance,
      date: todayString,
    });
  } catch (error) {
    console.error("今日の勤怠取得エラー:", error);
    return NextResponse.json(
      { error: "今日の勤怠情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}