import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPageAccess } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    
    if (!page) {
      return NextResponse.json({ error: "ページが指定されていません" }, { status: 400 });
    }

    const hasAccess = await hasPageAccess(currentUser.id, page as any);
    
    return NextResponse.json({ hasAccess });
  } catch (error) {
    console.error("ページアクセス確認エラー:", error);
    return NextResponse.json(
      { error: "アクセス権限の確認に失敗しました" },
      { status: 500 }
    );
  }
}