import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(request: Request) {
  try {
    console.log("TEST API - 開始");
    
    // 認証チェック
    const currentUser = await getCurrentUser(request as any);
    console.log("TEST API - 認証ユーザー:", currentUser?.email, currentUser?.customRole.name);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // リクエストボディを読み取り
    const data = await request.json();
    console.log("TEST API - 受信データ:", data);
    
    // データベース操作をテスト
    const settings = await prisma.systemSetting.findFirst();
    console.log("TEST API - 既存設定:", settings);
    
    if (settings) {
      const updateData: any = {};
      if (data.companyName !== undefined) updateData.companyName = data.companyName;
      if (data.companyUserIdPrefix !== undefined) updateData.companyUserIdPrefix = data.companyUserIdPrefix;
      if (data.headerCopyright !== undefined) updateData.headerCopyright = data.headerCopyright;
      
      console.log("TEST API - 更新データ:", updateData);
      
      const updated = await prisma.systemSetting.update({
        where: { id: settings.id },
        data: updateData,
      });
      console.log("TEST API - 更新完了:", updated);
      return NextResponse.json({ success: true, settings: updated });
    } else {
      return NextResponse.json({ error: "設定が見つかりません" }, { status: 404 });
    }
    
  } catch (error) {
    console.error("TEST API - エラー:", error);
    console.error("TEST API - エラー詳細:", {
      name: error?.constructor?.name,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        error: "テストAPIでエラーが発生しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}