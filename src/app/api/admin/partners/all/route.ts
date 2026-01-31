import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // パートナー管理権限をチェック
    const hasPartnerPermission = await hasPermission(currentUser.id, "systemSettings", "managePartners");

    // レポート閲覧等のために、各管理機能の閲覧権限（全体）がある場合も許可
    const canViewAllAttendance = await hasPermission(currentUser.id, "attendanceManagement", "viewAll");
    const canViewAllExpense = await hasPermission(currentUser.id, "expenseManagement", "viewAll");
    const canViewAllShift = await hasPermission(currentUser.id, "shiftManagement", "viewAll");

    if (!hasPartnerPermission && !canViewAllAttendance && !canViewAllExpense && !canViewAllShift) {
      return NextResponse.json({ error: "パートナー情報を閲覧する権限がありません" }, { status: 403 });
    }

    // すべてのパートナー企業を取得（アクティブ・非アクティブ両方）
    const partners = await prisma.partner.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`パートナー全件取得: ${partners.length}件 (User: ${currentUser.id})`);

    const response = NextResponse.json(partners);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: unknown) {
    console.error("パートナー取得エラー:", error);
    return NextResponse.json(
      { error: "パートナー情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}