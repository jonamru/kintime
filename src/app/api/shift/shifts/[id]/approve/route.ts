import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, comment } = await request.json();

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // シフト承認権限をチェック
    const hasApprovePermission = await hasPermission(currentUser.id, "shiftManagement", "approve");
    if (!hasApprovePermission) {
      return NextResponse.json({ error: "シフト承認権限がありません" }, { status: 403 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: "無効なアクションです" }, { status: 400 });
    }

    // シフトの存在確認
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "シフトが見つかりません" }, { status: 404 });
    }

    if (shift.status !== 'PENDING') {
      return NextResponse.json({ error: "承認待ち以外のシフトは処理できません" }, { status: 400 });
    }

    // ステータス更新
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    
    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        status: newStatus,
        // 管理者コメントを保存する場合は別フィールドを追加する必要がある
        // approverComment: comment,
        // approvedBy: admin.id,
        // approvedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // TODO: 通知機能があれば、ユーザーに結果を通知

    return NextResponse.json({
      message: `シフトを${action === 'approve' ? '承認' : '却下'}しました`,
      shift: updatedShift,
    });
  } catch (error) {
    console.error("シフト承認エラー:", error);
    return NextResponse.json(
      { error: "承認処理に失敗しました" },
      { status: 500 }
    );
  }
}