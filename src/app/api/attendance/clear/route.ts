import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser(request as any);
    
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 今日の打刻データを削除
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deleted = await prisma.attendance.deleteMany({
      where: {
        userId: user.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return NextResponse.json({
      message: `${deleted.count}件の打刻データを削除しました`,
      deleted: deleted.count,
    });
  } catch (error) {
    console.error("打刻削除エラー:", error);
    return NextResponse.json(
      { error: "打刻データの削除に失敗しました" },
      { status: 500 }
    );
  }
}