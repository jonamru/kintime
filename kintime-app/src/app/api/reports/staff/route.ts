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
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "月が必要です" }, { status: 400 });
  }

  try {
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // 権限に応じてフィルタリング
    let whereClause: any = {};
    if (session.user.role === "MANAGER") {
      whereClause.managerId = session.user.id;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        attendances: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        expenses: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            type: "TRANSPORT",
            status: "APPROVED",
          },
        },
      },
    });

    const reportData = users.map((user) => {
      // 勤務日数を計算（出勤打刻がある日をカウント）
      const workDays = new Set(
        user.attendances
          .filter(att => att.type === "CLOCK_IN")
          .map(att => att.date.toDateString())
      ).size;

      // 総勤務時間を計算
      const attendancesByDate = user.attendances.reduce((acc: any, att) => {
        const dateKey = att.date.toDateString();
        if (!acc[dateKey]) acc[dateKey] = {};
        acc[dateKey][att.type] = att.clockTime;
        return acc;
      }, {});

      let totalHours = 0;
      Object.values(attendancesByDate).forEach((dayData: any) => {
        if (dayData.CLOCK_IN && dayData.CLOCK_OUT) {
          const workMs = new Date(dayData.CLOCK_OUT).getTime() - new Date(dayData.CLOCK_IN).getTime();
          totalHours += workMs / (1000 * 60 * 60);
        }
      });

      // 交通費合計
      const totalTransport = user.expenses.reduce((sum, expense) => sum + expense.amount, 0);

      return {
        name: user.name,
        workDays,
        totalHours: Math.round(totalHours * 10) / 10,
        totalTransport,
      };
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("スタッフレポートエラー:", error);
    return NextResponse.json(
      { error: "スタッフレポートの取得に失敗しました" },
      { status: 500 }
    );
  }
}