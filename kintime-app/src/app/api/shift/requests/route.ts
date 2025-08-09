import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || "");
  const month = parseInt(searchParams.get("month") || "");

  if (!year || !month) {
    return NextResponse.json({ error: "年月が必要です" }, { status: 400 });
  }

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const shiftRequests = await prisma.shiftRequest.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(shiftRequests);
  } catch (error) {
    console.error("シフト希望取得エラー:", error);
    return NextResponse.json(
      { error: "シフト希望の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { requests } = await request.json();

    // 既存のシフト希望を削除
    const dates = requests.map((req: any) => new Date(req.date));
    const startDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
    const endDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
    endDate.setHours(23, 59, 59);

    await prisma.shiftRequest.deleteMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // 新しいシフト希望を作成
    const shiftRequestData = requests.map((req: any) => ({
      userId: session.user.id,
      date: new Date(req.date),
      isAvailable: req.isAvailable,
    }));

    await prisma.shiftRequest.createMany({
      data: shiftRequestData,
    });

    return NextResponse.json({ message: "シフト希望を更新しました" });
  } catch (error) {
    console.error("シフト希望更新エラー:", error);
    return NextResponse.json(
      { error: "シフト希望の更新に失敗しました" },
      { status: 500 }
    );
  }
}