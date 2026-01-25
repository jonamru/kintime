import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";

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

    // 全ロールを取得
    const roles = await prisma.customRole.findMany();

    for (const role of roles) {
      const pageAccess = (role.pageAccess as Record<string, unknown>) || {};
      
      // 管理者系ロールに一括修正権限を追加
      if (['SUPER_ADMIN', 'MANAGER'].includes(role.name)) {
        pageAccess.bulkEdit = true;
      } else {
        // 他のロールには基本的に無効
        pageAccess.bulkEdit = false;
      }

      // ロールを更新
      await prisma.customRole.update({
        where: { id: role.id },
        data: { 
          pageAccess: pageAccess as Prisma.InputJsonValue
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "一括修正権限を更新しました",
      updatedRoles: roles.length 
    });

  } catch (error: unknown) {
    console.error("権限更新エラー:", error);
    return NextResponse.json(
      { error: "権限の更新に失敗しました" },
      { status: 500 }
    );
  }
}