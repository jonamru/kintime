import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canEditExpenseByDate } from "@/lib/permissions";

// 交通費の個別取得
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        locker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "交通費が見つかりません" }, { status: 404 });
    }

    // 全経費閲覧権限がない場合は自分のデータのみ閲覧可能
    const canViewAll = await hasPermission(currentUser.id, "expenseManagement", "viewAll");
    if (!canViewAll && expense.userId !== currentUser.id) {
      return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error("交通費取得エラー:", error);
    return NextResponse.json(
      { error: "交通費の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 交通費の更新
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const existingExpense = await prisma.expense.findUnique({
      where: { id: params.id }
    });

    if (!existingExpense) {
      return NextResponse.json({ error: "交通費が見つかりません" }, { status: 404 });
    }

    // 全経費閲覧権限がない場合は自分のデータのみ編集可能
    const canViewAll = await hasPermission(currentUser.id, "expenseManagement", "viewAll");
    if (!canViewAll && existingExpense.userId !== currentUser.id) {
      return NextResponse.json({ error: "編集権限がありません" }, { status: 403 });
    }

    // ロックされている場合は編集不可
    if (existingExpense.isLocked) {
      return NextResponse.json({ error: "この交通費はロックされているため編集できません" }, { status: 403 });
    }

    // 期限制限チェック
    const canEdit = await canEditExpenseByDate(existingExpense.date, currentUser.id);
    if (!canEdit) {
      return NextResponse.json({ error: "編集期限を過ぎているため編集できません（翌月3日まで）" }, { status: 403 });
    }

    const { type, date, departure, arrival, route, amount, description, referenceUrl, validFrom, validUntil, imageUrl, tripType } = await request.json();

    // バリデーション
    if (!type || !date || !amount) {
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

    const updateData = {
      date: new Date(date),
      type,
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
    };

    const updatedExpense = await prisma.expense.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error("交通費更新エラー:", error);
    return NextResponse.json(
      { error: "交通費の更新に失敗しました" },
      { status: 500 }
    );
  }
}

// 交通費のロック/アンロック
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 経費ロック権限をチェック
    const hasLockPermission = await hasPermission(currentUser.id, "expenseManagement", "lock");
    if (!hasLockPermission) {
      return NextResponse.json({ error: "ロック操作の権限がありません" }, { status: 403 });
    }

    const { action } = await request.json();

    if (action !== 'lock' && action !== 'unlock') {
      return NextResponse.json({ error: "無効なアクション" }, { status: 400 });
    }

    const updateData = action === 'lock' ? {
      isLocked: true,
      lockedBy: currentUser.id,
      lockedAt: new Date(),
    } : {
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
    };

    const updatedExpense = await prisma.expense.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        locker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error("交通費ロック操作エラー:", error);
    return NextResponse.json(
      { error: "ロック操作に失敗しました" },
      { status: 500 }
    );
  }
}

// 交通費の削除
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const existingExpense = await prisma.expense.findUnique({
      where: { id: params.id }
    });

    if (!existingExpense) {
      return NextResponse.json({ error: "交通費が見つかりません" }, { status: 404 });
    }

    // 削除権限をチェック
    const hasDeletePermission = await hasPermission(currentUser.id, "expenseManagement", "delete");
    const canViewAll = await hasPermission(currentUser.id, "expenseManagement", "viewAll");
    
    // 管理者または自分のデータのみ削除可能
    if (!hasDeletePermission && (!canViewAll && existingExpense.userId !== currentUser.id)) {
      return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
    }

    // ロックされている場合は削除不可
    if (existingExpense.isLocked) {
      return NextResponse.json({ error: "この交通費はロックされているため削除できません" }, { status: 403 });
    }

    // 期限制限チェック
    const canEdit = await canEditExpenseByDate(existingExpense.date, currentUser.id);
    if (!canEdit) {
      return NextResponse.json({ error: "削除期限を過ぎているため削除できません（翌月3日まで）" }, { status: 403 });
    }

    await prisma.expense.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: "交通費を削除しました" });
  } catch (error) {
    console.error("交通費削除エラー:", error);
    return NextResponse.json(
      { error: "交通費の削除に失敗しました" },
      { status: 500 }
    );
  }
}