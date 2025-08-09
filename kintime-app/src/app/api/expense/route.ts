import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expenses = await prisma.expense.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("経費取得エラー:", error);
    return NextResponse.json(
      { error: "経費の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      type,
      amount,
      description,
      departure,
      arrival,
      route,
      referenceUrl,
      date,
    } = await request.json();

    const expense = await prisma.expense.create({
      data: {
        userId: session.user.id,
        type,
        amount,
        description,
        departure: type === "TRANSPORT" ? departure : null,
        arrival: type === "TRANSPORT" ? arrival : null,
        route: type === "TRANSPORT" ? route : null,
        referenceUrl: type === "TRANSPORT" ? referenceUrl : null,
        date: new Date(date),
        status: "PENDING",
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("経費作成エラー:", error);
    return NextResponse.json(
      { error: "経費の作成に失敗しました" },
      { status: 500 }
    );
  }
}