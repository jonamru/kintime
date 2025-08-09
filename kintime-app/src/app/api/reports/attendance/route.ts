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
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "月が必要です" }, { status: 400 });
  }

  try {
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // 権限に応じてフィルタリング
    let whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (session.user.role === "MANAGER") {
      whereClause.user = {
        managerId: session.user.id,
      };
    } else if (session.user.role === "PARTNER_MANAGER") {
      whereClause.user = {
        partnerId: session.user.partnerId,
      };
    } else if (session.user.role === "STAFF" || session.user.role === "PARTNER_STAFF") {
      whereClause.userId = session.user.id;
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        user: true,
      },
      orderBy: [
        { date: "asc" },
        { user: { name: "asc" } },
      ],
    });

    // 日付とユーザーごとにグループ化
    const groupedData = attendances.reduce((acc: any, attendance) => {
      const dateKey = attendance.date.toDateString();
      const userId = attendance.userId;
      const key = `${dateKey}-${userId}`;

      if (!acc[key]) {
        acc[key] = {
          date: attendance.date,
          user: attendance.user,
          clockIn: null,
          clockOut: null,
          workHours: null,
        };
      }

      if (attendance.type === "CLOCK_IN") {
        acc[key].clockIn = attendance.clockTime;
      } else if (attendance.type === "CLOCK_OUT") {
        acc[key].clockOut = attendance.clockTime;
      }

      return acc;
    }, {});

    // 勤務時間を計算
    const reportData = Object.values(groupedData).map((item: any) => {
      if (item.clockIn && item.clockOut) {
        const workMs = new Date(item.clockOut).getTime() - new Date(item.clockIn).getTime();
        const workHours = Math.round(workMs / (1000 * 60 * 60) * 10) / 10;
        item.workHours = `${workHours}時間`;
      }
      return item;
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("勤怠レポートエラー:", error);
    return NextResponse.json(
      { error: "勤怠レポートの取得に失敗しました" },
      { status: 500 }
    );
  }
}