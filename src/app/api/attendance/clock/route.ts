import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getJapanNow, getJapanTodayString, getJapanDayRange } from "@/lib/dateUtils";

export async function POST(request: Request) {
  try {
    const { type, latitude, longitude } = await request.json();

    const user = await getCurrentUser(request as any);
    
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 日本時間で今日の日付範囲を取得
    const now = getJapanNow();
    const todayString = getJapanTodayString();
    const { startOfDay, endOfDay } = getJapanDayRange(todayString);
    
    console.log("打刻チェック（日本時間）:", {
      userId: user.id,
      userEmail: user.email,
      type,
      todayString: todayString,
      japanNow: now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    });

    // 今日のシフトがあるかチェック（日本時間基準）
    console.log("シフト検索 - 今日の日付文字列（日本時間）:", todayString);
    
    const todayShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: "APPROVED",
      },
    });
    
    console.log("シフト検索結果:", {
      found: !!todayShift,
      shift: todayShift,
      searchRange: {
        gte: startOfDay.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        lte: endOfDay.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      }
    });

    if (!todayShift) {
      return NextResponse.json(
        { error: "本日はシフトが登録されていないため打刻できません" },
        { status: 400 }
      );
    }

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        type,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    console.log("既存の打刻:", existingAttendance);

    if (existingAttendance) {
      return NextResponse.json(
        { error: "すでに打刻済みです" },
        { status: 400 }
      );
    }

    // 新しい打刻を作成（日本時間）
    const attendance = await prisma.attendance.create({
      data: {
        userId: user.id,
        date: now,
        type,
        clockTime: now,
        latitude,
        longitude,
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("打刻エラー:", error);
    return NextResponse.json(
      { error: "打刻に失敗しました" },
      { status: 500 }
    );
  }
}