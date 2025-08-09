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
    if (!hasPartnerPermission) {
      return NextResponse.json({ error: "パートナー管理権限がありません" }, { status: 403 });
    }

    // すべてのパートナー企業を取得（アクティブ・非アクティブ両方）
    const partners = await prisma.partner.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(partners);
  } catch (error) {
    console.error("パートナー取得エラー:", error);
    return NextResponse.json(
      { error: "パートナー情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}