import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let whereClause: any = {};

    if (session.user.role === "MANAGER") {
      // 担当別管理者は自分の管理下のユーザーのみ
      whereClause.managerId = session.user.id;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        partner: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("ユーザー取得エラー:", error);
    return NextResponse.json(
      { error: "ユーザーの取得に失敗しました" },
      { status: 500 }
    );
  }
}