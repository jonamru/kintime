import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId, projectId, date, startTime, endTime, shiftType, location } = await request.json();

    // 同じ日にすでにシフトがないかチェック
    const existingShift = await prisma.shift.findFirst({
      where: {
        userId,
        date: new Date(date),
        status: {
          not: "CANCELLED",
        },
      },
    });

    if (existingShift) {
      return NextResponse.json(
        { error: "この日は既にシフトが登録されています" },
        { status: 400 }
      );
    }

    // 新しいシフトを作成
    const shift = await prisma.shift.create({
      data: {
        userId,
        projectId,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        shiftType,
        location: shiftType === "SPOT" ? location : null,
        status: "CONFIRMED",
      },
      include: {
        user: true,
        project: true,
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error("シフト作成エラー:", error);
    return NextResponse.json(
      { error: "シフトの作成に失敗しました" },
      { status: 500 }
    );
  }
}