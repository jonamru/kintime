import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 全ロールを取得
    const roles = await prisma.customRole.findMany({
      orderBy: [
        { isSystem: "desc" },
        { name: "asc" },
      ],
    });
    
    return NextResponse.json(roles);
  } catch (error) {
    console.error("ロール取得エラー:", error);
    return NextResponse.json(
      { error: "ロールの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 権限チェック
    const hasManagePermission = await hasPermission(currentUser.id, "systemSettings", "manageRoles");
    if (!hasManagePermission) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const data = await request.json();
    
    // ロール名の重複チェック
    const existingRole = await prisma.customRole.findUnique({
      where: { name: data.name },
    });
    
    if (existingRole) {
      return NextResponse.json(
        { error: "このロール名は既に使用されています" },
        { status: 400 }
      );
    }
    
    // 新しいロールを作成
    const role = await prisma.customRole.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        isSystem: false,
        permissions: data.permissions,
        pageAccess: data.pageAccess,
      },
    });
    
    return NextResponse.json(role);
  } catch (error) {
    console.error("ロール作成エラー:", error);
    return NextResponse.json(
      { error: "ロールの作成に失敗しました" },
      { status: 500 }
    );
  }
}