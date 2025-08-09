import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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
    
    // ロールの存在確認
    const existingRole = await prisma.customRole.findUnique({
      where: { id: params.id },
    });
    
    if (!existingRole) {
      return NextResponse.json(
        { error: "ロールが見つかりません" },
        { status: 404 }
      );
    }
    
    // ロールを更新
    const role = await prisma.customRole.update({
      where: { id: params.id },
      data: {
        displayName: data.displayName,
        permissions: data.permissions,
        pageAccess: data.pageAccess,
      },
    });
    
    return NextResponse.json(role);
  } catch (error) {
    console.error("ロール更新エラー:", error);
    return NextResponse.json(
      { error: "ロールの更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 権限チェック
    const hasManagePermission = await hasPermission(currentUser.id, "systemSettings", "manageRoles");
    if (!hasManagePermission) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    
    // ロールの存在確認
    const existingRole = await prisma.customRole.findUnique({
      where: { id: params.id },
    });
    
    if (!existingRole) {
      return NextResponse.json(
        { error: "ロールが見つかりません" },
        { status: 404 }
      );
    }
    
    // システムロールは削除不可
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: "システムロールは削除できません" },
        { status: 400 }
      );
    }
    
    // このロールを使用しているユーザーがいるかチェック
    const usersWithRole = await prisma.user.count({
      where: { customRoleId: params.id },
    });
    
    if (usersWithRole > 0) {
      return NextResponse.json(
        { error: `このロールは${usersWithRole}人のユーザーが使用しているため削除できません` },
        { status: 400 }
      );
    }
    
    // ロールを削除
    await prisma.customRole.delete({
      where: { id: params.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ロール削除エラー:", error);
    return NextResponse.json(
      { error: "ロールの削除に失敗しました" },
      { status: 500 }
    );
  }
}