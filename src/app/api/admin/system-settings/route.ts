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

    let settings = await prisma.systemSetting.findFirst();
    
    if (!settings) {
      // 初期設定がない場合は作成
      settings = await prisma.systemSetting.create({
        data: { shiftApprovalDeadlineDays: 3 }
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("システム設定取得エラー:", error);
    return NextResponse.json(
      { error: "システム設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 権限チェック
    const roleName = currentUser.customRole?.name || 'UNKNOWN';
    console.log("権限チェック開始:", {
      userId: currentUser.id,
      userRole: roleName,
      userEmail: currentUser.email
    });
    
    try {
      const hasManagePermission = await hasPermission(currentUser.id, "systemSettings", "manageCompany");
      console.log("権限チェック結果:", hasManagePermission);
      
      if (!hasManagePermission) {
        // 一時的にSUPER_ADMINは権限チェックをスキップ
        if (roleName !== 'SUPER_ADMIN') {
          return NextResponse.json({ error: "権限がありません" }, { status: 403 });
        }
        console.log("SUPER_ADMINのため権限チェックをスキップ");
      }
    } catch (permError) {
      console.error("権限チェックでエラー:", permError);
      // エラーが発生した場合、SUPER_ADMINは通過させる
      if (roleName !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: "権限チェックに失敗しました" }, { status: 500 });
      }
    }

    const { 
      shiftApprovalDeadlineDays, 
      companyName, 
      companyUserIdPrefix,
      headerCopyright 
    } = await request.json();

    // shiftApprovalDeadlineDaysが指定されている場合のみ検証
    if (shiftApprovalDeadlineDays !== undefined && (shiftApprovalDeadlineDays < 1 || shiftApprovalDeadlineDays > 31)) {
      return NextResponse.json(
        { error: "承認期限は1日〜31日の間で設定してください" },
        { status: 400 }
      );
    }

    // プレフィックスの検証
    if (companyUserIdPrefix && (!companyUserIdPrefix.trim() || companyUserIdPrefix.trim().length !== 4)) {
      return NextResponse.json(
        { error: "ユーザーIDプレフィックスは4文字必須です" },
        { status: 400 }
      );
    }

    // プレフィックスの重複チェック（一時的に無効化）
    if (companyUserIdPrefix) {
      console.log("プレフィックス設定をスキップ（開発中）:", companyUserIdPrefix);
      // try {
      //   const { checkPrefixDuplicate } = await import("@/lib/userIdGenerator");
      //   const prefixExists = await checkPrefixDuplicate(companyUserIdPrefix.trim().toUpperCase());
      //   
      //   if (prefixExists) {
      //     // 既存の自社設定と同じ場合は問題なし
      //     try {
      //       const existingSettings = await prisma.systemSetting.findFirst();
      //       if (!existingSettings || existingSettings.companyUserIdPrefix !== companyUserIdPrefix.trim().toUpperCase()) {
      //         return NextResponse.json(
      //           { error: "このユーザーIDプレフィックスは既に使用されています" },
      //           { status: 400 }
      //         );
      //       }
      //     } catch (error) {
      //       // SystemSetting テーブルがまだ存在しない場合は続行
      //       console.log("SystemSetting table not found, continuing with creation");
      //     }
      //   }
      // } catch (error) {
      //   console.log("Prefix duplicate check failed, continuing:", error);
      // }
    }

    console.log("受信したデータ:", {
      shiftApprovalDeadlineDays,
      companyName,
      companyUserIdPrefix,
      headerCopyright
    });

    // 既存の設定を更新、なければ作成
    let settings = await prisma.systemSetting.findFirst();
    console.log("既存の設定:", settings);
    
    const updateData: any = {};
    if (shiftApprovalDeadlineDays !== undefined) updateData.shiftApprovalDeadlineDays = shiftApprovalDeadlineDays;
    if (companyName !== undefined) updateData.companyName = companyName || null;
    if (companyUserIdPrefix !== undefined) updateData.companyUserIdPrefix = companyUserIdPrefix?.trim().toUpperCase() || null;
    if (headerCopyright !== undefined) updateData.headerCopyright = headerCopyright || null;
    
    console.log("更新データ:", updateData);
    
    if (settings) {
      console.log("既存設定を更新中...");
      settings = await prisma.systemSetting.update({
        where: { id: settings.id },
        data: updateData
      });
      console.log("更新完了:", settings);
    } else {
      console.log("新規設定を作成中...");
      settings = await prisma.systemSetting.create({
        data: updateData
      });
      console.log("作成完了:", settings);
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("システム設定更新エラー - 詳細:", {
      error: error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        error: "システム設定の更新に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// POSTメソッドも互換性のために残す
export async function POST(request: Request) {
  return PUT(request);
}