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

    // 簡単な認証（実際にはセッションから取得）
    const userEmail = "admin@example.com";
    
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const shiftRequests = await prisma.shiftRequest.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startDate,
          lte: endDate,
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

export async function POST(request: Request) {
  try {
    const { date, isAvailable, note } = await request.json();

    // 簡単な認証（実際にはセッションから取得）
    const userEmail = "admin@example.com";
    
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const requestDate = new Date(date);

    // 既存のシフト希望があるかチェック
    const existingRequest = await prisma.shiftRequest.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: requestDate,
        },
      },
    });

    let shiftRequest;

    if (existingRequest) {
      // 更新
      shiftRequest = await prisma.shiftRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          isAvailable,
          note: note || null,
        },
      });
    } else {
      // 新規作成
      shiftRequest = await prisma.shiftRequest.create({
        data: {
          userId: user.id,
          date: requestDate,
          isAvailable,
          note: note || null,
        },
      });
    }

    return NextResponse.json(shiftRequest);
  } catch (error) {
    console.error("シフト希望更新エラー:", error);
    return NextResponse.json(
      { error: "シフト希望の更新に失敗しました" },
      { status: 500 }
    );
  }
}