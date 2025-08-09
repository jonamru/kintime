import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendances = await prisma.attendance.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: {
        clockTime: "asc",
      },
    });

    return NextResponse.json(attendances);
  } catch (error) {
    console.error("勤怠取得エラー:", error);
    return NextResponse.json(
      { error: "勤怠情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}