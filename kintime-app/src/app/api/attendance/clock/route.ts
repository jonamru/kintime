import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { type, latitude, longitude } = await request.json();

    // 今日の同じタイプの打刻があるかチェック
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        type,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingAttendance) {
      return NextResponse.json(
        { error: "すでに打刻済みです" },
        { status: 400 }
      );
    }

    // 新しい打刻を作成
    const attendance = await prisma.attendance.create({
      data: {
        userId: session.user.id,
        date: new Date(),
        type,
        clockTime: new Date(),
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