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

    const shifts = await prisma.shift.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: "CONFIRMED",
      },
      include: {
        project: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("確定シフト取得エラー:", error);
    return NextResponse.json(
      { error: "確定シフトの取得に失敗しました" },
      { status: 500 }
    );
  }
}