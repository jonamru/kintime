import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExpenseType, ExpenseStatus } from '@prisma/client';
import { getCurrentUser } from "@/lib/auth";
import { canEditExpenseByDate } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const expenses = await prisma.expense.findMany({
      where: {
        userId: currentUser.id,
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
  try {
    console.log("=== 経費申請API開始 ===");
    
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    
    let requestBody;
    try {
      requestBody = await request.json();
      console.log("受信したリクエストボディ:", requestBody);
    } catch (parseError) {
      console.error("リクエストボディのパースエラー:", parseError);
      return NextResponse.json({ error: "不正なJSON形式です" }, { status: 400 });
    }
    
    const { type, date, departure, arrival, route, amount, description, referenceUrl, validFrom, validUntil, imageUrl, tripType } = requestBody;

    console.log("バリデーション開始:", { type, date, amount, departure, arrival, description });
    
    if (!type || !date || !amount) {
      console.error("必須項目が不足:", { type, date, amount });
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    if (type === 'TRANSPORT' && (!departure || !arrival)) {
      return NextResponse.json({ error: "交通費の場合、出発地と到着地は必須です" }, { status: 400 });
    }

    if (type === 'LODGING' && !description) {
      return NextResponse.json({ error: "宿泊費の場合、詳細は必須です" }, { status: 400 });
    }

    if (type === 'COMMUTE_PASS' && (!departure || !arrival || !validFrom || !validUntil)) {
      return NextResponse.json({ error: "定期券の場合、開始駅、終了駅、開始日、終了日は必須です" }, { status: 400 });
    }

    // 期限制限チェック
    const canRegister = await canEditExpenseByDate(date, currentUser.id);
    if (!canRegister) {
      return NextResponse.json({ error: "登録期限を過ぎています（翌月3日まで）" }, { status: 403 });
    }

    const createData = {
      userId: currentUser.id,
      date: new Date(date),
      type: type as ExpenseType,
      amount: parseFloat(amount),
      description: description || null,
      departure: (type === 'TRANSPORT' || type === 'COMMUTE_PASS') ? departure : null,
      arrival: (type === 'TRANSPORT' || type === 'COMMUTE_PASS') ? arrival : null,
      route: type === 'TRANSPORT' ? route : null,
      referenceUrl: referenceUrl || null,
      validFrom: type === 'COMMUTE_PASS' && validFrom ? new Date(validFrom) : null,
      validUntil: type === 'COMMUTE_PASS' && validUntil ? new Date(validUntil) : null,
      imageUrl: imageUrl || null,
      tripType: type === 'TRANSPORT' ? tripType : null,
      status: ExpenseStatus.APPROVED,
    };
    
    console.log("経費作成データ:", createData);

    let expense;
    try {
      expense = await prisma.expense.create({
        data: createData,
      });
      console.log("経費作成成功:", { id: expense.id, amount: expense.amount });
    } catch (dbError) {
      console.error("経費作成データベースエラー:", dbError);
      console.error("Prismaエラー詳細:", {
        code: (dbError as any)?.code,
        message: dbError instanceof Error ? dbError.message : String(dbError),
        meta: (dbError as any)?.meta,
        clientVersion: (dbError as any)?.clientVersion
      });
      return NextResponse.json({ 
        error: "データベースエラーが発生しました",
        details: dbError instanceof Error ? dbError.message : String(dbError),
        code: (dbError as any)?.code 
      }, { status: 500 });
    }

    console.log("=== 経費申請API完了 ===");
    return NextResponse.json(expense);
  } catch (error) {
    console.error("経費作成エラー:", error);
    console.error("エラー詳細:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "経費申請に失敗しました", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}