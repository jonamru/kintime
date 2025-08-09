import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // スーパー管理者権限チェック
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { customRole: true }
    });

    if (!user || user.customRole?.name !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: "スーパー管理者権限が必要です" }, { status: 403 });
    }

    // 全ロールを取得して更新
    const roles = await prisma.customRole.findMany();
    let updatedCount = 0;

    for (const role of roles) {
      let needsUpdate = false;
      let pageAccess = role.pageAccess as any || {};
      
      // bulkEditフィールドが存在しない場合のみ追加
      if (!('bulkEdit' in pageAccess)) {
        // 全てのロールにデフォルトでfalseを設定（後で管理画面で個別に有効化可能）
        pageAccess.bulkEdit = false;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await prisma.customRole.update({
          where: { id: role.id },
          data: { 
            pageAccess: pageAccess as any
          }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${updatedCount}個のロールに一括修正権限フィールドを追加しました`,
      updatedRoles: updatedCount
    });

  } catch (error) {
    console.error("権限フィールド追加エラー:", error);
    return NextResponse.json(
      { error: "権限フィールドの追加に失敗しました", details: (error as Error).message },
      { status: 500 }
    );
  }
}