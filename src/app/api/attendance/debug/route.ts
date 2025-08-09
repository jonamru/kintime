import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request as any);
    
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 今日の日付範囲を計算
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // すべての打刻データを取得
    const allAttendances = await prisma.attendance.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        clockTime: "desc",
      },
      take: 10,
    });

    // 今日の打刻データを取得
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      dateRange: {
        today: today.toISOString(),
        tomorrow: tomorrow.toISOString(),
      },
      allAttendances: allAttendances.map(a => ({
        id: a.id,
        type: a.type,
        date: a.date,
        clockTime: a.clockTime,
      })),
      todayAttendances: todayAttendances.map(a => ({
        id: a.id,
        type: a.type,
        date: a.date,
        clockTime: a.clockTime,
      })),
    });
  } catch (error) {
    console.error("デバッグエラー:", error);
    return NextResponse.json(
      { error: "デバッグ情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}