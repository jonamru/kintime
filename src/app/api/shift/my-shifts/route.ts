import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatJapanDate, formatJapanDateTime } from "@/lib/dateUtils";

export async function GET(request: Request) {
  try {
    // 認証
    const user = await getCurrentUser(request as any);
    
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const shifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        date: "desc",
      },
    });

    // 日付を日本時間基準で返す
    const shiftsWithJapanDates = shifts.map(shift => ({
      ...shift,
      date: formatJapanDate(shift.date),
      startTime: formatJapanDateTime(shift.startTime),
      endTime: formatJapanDateTime(shift.endTime),
    }));

    return NextResponse.json(shiftsWithJapanDates);
  } catch (error) {
    console.error("自分のシフト取得エラー:", error);
    return NextResponse.json(
      { error: "シフトの取得に失敗しました" },
      { status: 500 }
    );
  }
}