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

    const projects = await prisma.project.findMany({
      include: {
        shifts: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            status: "CONFIRMED",
          },
        },
      },
    });

    const reportData = projects.map((project) => {
      const shiftCount = project.shifts.length;
      const profit = project.contractPrice && project.paymentPrice 
        ? (project.contractPrice - project.paymentPrice) * shiftCount
        : null;

      return {
        name: project.name,
        client: project.client,
        contractPrice: project.contractPrice,
        paymentPrice: project.paymentPrice,
        shiftCount,
        profit,
      };
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("プロジェクトレポートエラー:", error);
    return NextResponse.json(
      { error: "プロジェクトレポートの取得に失敗しました" },
      { status: 500 }
    );
  }
}