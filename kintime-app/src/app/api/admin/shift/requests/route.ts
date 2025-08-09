import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "MANAGER")) {
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

    // 管理者権限に応じてフィルタリング
    let whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
      isAvailable: true,
    };

    if (session.user.role === "MANAGER") {
      // 担当別管理者は自分の管理下のユーザーのみ
      whereClause.user = {
        managerId: session.user.id,
      };
    }

    const shiftRequests = await prisma.shiftRequest.findMany({
      where: whereClause,
      include: {
        user: {
          include: {
            partner: true,
          },
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