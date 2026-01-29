import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

    const shifts = await prisma.shift.findMany({
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
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(shifts);
  } catch (error: unknown) {
    console.error("シフト取得エラー:", error);
    return NextResponse.json(
      { error: "シフトの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { date, startTime, endTime, shiftType, location, breakTime, note } = await request.json();

    // 認証ユーザーを取得
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // APIでは userEmail ではなく、認証済みユーザーのIDなどを使用するが、
    // ここではPOSTデータを作成する際に currentUser を使用する。
    // 元のコードは "admin@example.com" でユーザーを引いていたが、
    // 本来は認証済みユーザー自身として作成すべき。

    // しかし、元のロジックが `user` 変数をDBから引いているので、
    // getCurrentUserの結果をそのまま使うか、再取得するか。
    // getCurrentUserはAuthUser型を返す。PrismaのUser型に近いが完全ではないかもしれない。
    // ここではPrismaのUserが必要ならIDで引くのが安全。

    // AuthUser (currentUser) には id があるのでそれを使う。
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    if (!date || !startTime || !endTime || !location) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // 日付文字列から年月日を直接パース
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const startDateTime = new Date(year, month - 1, day, ...startTime.split(':').map(Number));
    const endDateTime = new Date(year, month - 1, day, ...endTime.split(':').map(Number));

    // 既存のシフトチェック（同じユーザー、同じ日）
    const existingShift = await prisma.shift.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: localDate,
          lt: new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate() + 1),
        },
      },
    });

    if (existingShift) {
      return NextResponse.json(
        { error: "この日は既にシフト申請があります" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        userId: user.id,
        date: localDate,
        startTime: startDateTime,
        endTime: endDateTime,
        breakTime: breakTime ?? 60,
        shiftType,
        location,
        note: note || null,
        status: "PENDING",
      },
    });

    return NextResponse.json(shift);
  } catch (error: unknown) {
    console.error("シフト作成エラー:", error);
    console.error("エラー詳細:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "シフト申請に失敗しました", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}