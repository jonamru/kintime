import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ユーザー編集権限をチェック
    const hasEditPermission = await hasPermission(currentUser.id, "userManagement", "edit");
    if (!hasEditPermission) {
      return NextResponse.json({ error: "ユーザー編集権限がありません" }, { status: 403 });
    }

    const {
      userId,
      name,
      email,
      password,
      customRoleId,
      partnerId,
      managerIds,
      birthDate,
      defaultLocation,
      gpsEnabled,
      wakeUpEnabled,
      departureEnabled,
    } = await request.json();

    // 対象ユーザーの存在確認
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    // 必須フィールドの検証
    if (!name || !email || !customRoleId) {
      return NextResponse.json(
        { error: "名前、メールアドレス、権限は必須です" },
        { status: 400 }
      );
    }

    // メール重複チェック（自分以外）
    if (email !== existingUser.email) {
      const duplicateUser = await prisma.user.findUnique({
        where: { email }
      });

      if (duplicateUser) {
        return NextResponse.json(
          { error: "このメールアドレスは既に使用されています" },
          { status: 400 }
        );
      }
    }

    // ユーザーID重複チェック（設定されている場合、かつ自分以外）
    if (userId && userId !== existingUser.userId) {
      const duplicateUserById = await prisma.user.findUnique({
        where: { userId }
      });

      if (duplicateUserById) {
        return NextResponse.json(
          { error: "このユーザーIDは既に使用されています" },
          { status: 400 }
        );
      }
    }

    // 更新データの準備
    const updateData: any = {
      userId: userId || null,
      name,
      email,
      customRoleId: customRoleId,
      partnerId: partnerId || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      defaultLocation: defaultLocation || null,
      gpsEnabled: gpsEnabled ?? true,
      wakeUpEnabled: wakeUpEnabled ?? false,
      departureEnabled: departureEnabled ?? false,
    };

    // 管理者の関連付けを更新
    if (managerIds !== undefined) {
      if (managerIds && managerIds.length > 0) {
        updateData.managers = {
          set: managerIds.map((id: string) => ({ id }))
        };
      } else {
        updateData.managers = {
          set: []
        };
      }
    }

    // パスワードが提供された場合のみハッシュ化して更新
    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // ユーザー更新
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        partner: true,
        managers: true,
        customRole: true,
      },
    });

    // パスワードを除外してレスポンス
    const { password: _, ...userResponse } = updatedUser;

    return NextResponse.json(userResponse);
  } catch (error) {
    console.error("ユーザー更新エラー:", error);
    return NextResponse.json(
      { error: "ユーザー情報の更新に失敗しました" },
      { status: 500 }
    );
  }
}

// ユーザー削除
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ユーザー削除権限をチェック
    const hasDeletePermission = await hasPermission(currentUser.id, "userManagement", "delete");
    if (!hasDeletePermission) {
      return NextResponse.json({ error: "ユーザー削除権限がありません" }, { status: 403 });
    }

    // 削除対象ユーザーの確認
    const userToDelete = await prisma.user.findUnique({
      where: { id }
    });

    if (!userToDelete) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    // 自分自身は削除できない
    if (userToDelete.id === currentUser.id) {
      return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
    }

    // 関連データを先に削除
    await prisma.$transaction(async (tx) => {
      // 出退勤記録の修正データを削除
      const attendances = await tx.attendance.findMany({
        where: { userId: id },
        select: { id: true }
      });
      
      if (attendances.length > 0) {
        await tx.correction.deleteMany({
          where: {
            attendanceId: {
              in: attendances.map(a => a.id)
            }
          }
        });
      }

      // 出退勤記録を削除
      await tx.attendance.deleteMany({
        where: { userId: id }
      });

      // シフト申請を削除
      await tx.shiftRequest.deleteMany({
        where: { userId: id }
      });

      // シフトを削除
      await tx.shift.deleteMany({
        where: { userId: id }
      });

      // 経費を削除
      await tx.expense.deleteMany({
        where: { userId: id }
      });

      // 定期券を削除
      await tx.commutePass.deleteMany({
        where: { userId: id }
      });

      // シフト登録ロックを削除
      await tx.shiftRegistrationLock.deleteMany({
        where: { userId: id }
      });

      // 最後にユーザーを削除
      await tx.user.delete({
        where: { id }
      });
    });

    return NextResponse.json({ message: "ユーザーを削除しました" });
  } catch (error) {
    console.error("ユーザー削除エラー:", error);
    return NextResponse.json(
      { error: "ユーザーの削除に失敗しました" },
      { status: 500 }
    );
  }
}