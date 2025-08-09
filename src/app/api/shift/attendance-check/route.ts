import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shiftId = searchParams.get('shiftId');

    if (!shiftId) {
      return NextResponse.json({ error: "シフトIDが必要です" }, { status: 400 });
    }

    // シフト情報を取得
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    });

    if (!shift) {
      return NextResponse.json({ error: "シフトが見つかりません" }, { status: 404 });
    }

    // そのシフト日の打刻記録があるかチェック
    const shiftDate = new Date(shift.date);
    const startOfDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: shift.userId,
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    return NextResponse.json({
      hasAttendance: !!attendance,
      shiftDate: shift.date,
      attendanceCount: attendance ? 1 : 0
    });
  } catch (error) {
    console.error("打刻チェックエラー:", error);
    return NextResponse.json(
      { error: "チェックに失敗しました" },
      { status: 500 }
    );
  }
}