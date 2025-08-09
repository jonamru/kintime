import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser || !(await isAdmin(currentUser.id))) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }
    
    // すべてのユーザーとその打刻データを取得
    const users = await prisma.user.findMany({
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        role: true,
        _count: {
          select: {
            attendances: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // a@aユーザーの打刻データを詳細に取得
    const aUser = await prisma.user.findUnique({
      where: { email: "a@a" },
      include: {
        attendances: {
          orderBy: {
            clockTime: "desc",
          },
          take: 10,
        },
      },
    });

    return NextResponse.json({
      allUsers: users,
      aUserDetails: aUser,
      currentUser: {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.customRole?.name || 'UNKNOWN',
      },
    });
  } catch (error) {
    console.error("デバッグエラー:", error);
    return NextResponse.json(
      { error: "デバッグ情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}