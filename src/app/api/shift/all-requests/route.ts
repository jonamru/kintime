import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '');
    const month = parseInt(searchParams.get('month') || '');

    if (!year || !month) {
      return NextResponse.json({ error: "年月が指定されていません" }, { status: 400 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const shiftRequests = await prisma.shiftRequest.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { user: { name: "asc" } },
      ],
    });

    return NextResponse.json(shiftRequests);
  } catch (error) {
    console.error("全シフト希望取得エラー:", error);
    return NextResponse.json(
      { error: "シフト希望の取得に失敗しました" },
      { status: 500 }
    );
  }
}