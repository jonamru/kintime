import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canAssignRole } from "@/lib/permissions";
import type { User, Attendance, Shift, Expense, CustomRole, Partner, ApiResponse, BulkEditPermissions } from "@/types/common";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const currentUser = await getCurrentUser(request);

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

    // ランクベースの権限チェック: 編集対象のロールランクを確認
    // 自分のランクより高い（または同等の）ロールは編集できない
    // ※仕様書: "The rank of the role being assigned or managed must be less than or equal to the actor's rank."
    // 这里では、より厳密に「自分よりランクが低いロールのみ編集可能」とするか「自分以下」とするか。
    // 仕様書のUser Delete/Editは"strictly less than"だが、Role Managementは"less than or equal to"とある。
    // しかし、自分のランクと同じロールを編集できてしまうと、権限昇格のリスクがあるため、
    // 基本的には「自分より低いランク」のみ許可するか、
    // または「同じランクのロール」を編集する場合でも「自分より高いランク」には設定できないようにする。
    // 安全のため、ここでも canAssignRole を使い、targetRank <= myRank であることを確認する
    // ただし、canAssignRoleは "targetRank <= myRank" を返す。
    // 編集対象のロールのランクが自分より高い場合はエラーにする

    // 既存ロールの管理権限チェック
    const canManageExisting = await canAssignRole(currentUser.id, existingRole.rank || 0);
    if (!canManageExisting) {
      // 特例: 自分自身のロールは編集できないようにすべきだが、ここでは簡単なチェック
      return NextResponse.json(
        { error: "このロールを編集する権限がありません（アクセスレベル不足）" },
        { status: 403 }
      );
    }

    // 新しいランクの設定がある場合、そのランクを付与できるかチェック
    if (data.rank !== undefined) {
      const canAssignNewRank = await canAssignRole(currentUser.id, data.rank);
      if (!canAssignNewRank) {
        return NextResponse.json(
          { error: "指定されたランクを設定する権限がありません" },
          { status: 403 }
        );
      }
    }

    // ロールを更新
    const role = await prisma.customRole.update({
      where: { id: params.id },
      data: {
        displayName: data.displayName,
        permissions: data.permissions,
        pageAccess: data.pageAccess,
        rank: data.rank,
      },
    });

    return NextResponse.json(role);
  } catch (error: unknown) {
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
    const currentUser = await getCurrentUser(request);

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

    // ランクベースの権限チェック: 削除対象のロールランクを確認
    const canManageExisting = await canAssignRole(currentUser.id, existingRole.rank || 0);
    if (!canManageExisting) {
      return NextResponse.json(
        { error: "このロールを削除する権限がありません（アクセスレベル不足）" },
        { status: 403 }
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
  } catch (error: unknown) {
    console.error("ロール削除エラー:", error);
    return NextResponse.json(
      { error: "ロールの削除に失敗しました" },
      { status: 500 }
    );
  }
}