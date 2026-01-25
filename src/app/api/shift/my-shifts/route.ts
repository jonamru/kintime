import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatJapanDate, formatJapanDateTime } from "@/lib/dateUtils";

export async function GET(request: Request) {
  try {
    // 認証
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // クエリパラメータ取得
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // 検索条件を構築
    const whereCondition: {
      userId: string;
      date?: { gte?: Date; lte?: Date };
    } = {
      userId: user.id,
    };

    // 期間指定がある場合はフィルタリング
    if (startDate || endDate) {
      whereCondition.date = {};
      if (startDate) {
        whereCondition.date.gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        whereCondition.date.lte = new Date(endDate + 'T23:59:59');
      }
    }

    const shifts = await prisma.shift.findMany({
      where: whereCondition,
      orderBy: {
        date: "asc",
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
  } catch (error: unknown) {
    console.error("自分のシフト取得エラー:", error);
    return NextResponse.json(
      { error: "シフトの取得に失敗しました" },
      { status: 500 }
    );
  }
}