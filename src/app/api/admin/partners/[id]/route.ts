import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log("Partner update request for ID:", id);

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      console.log("Authentication failed");
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // パートナー管理権限をチェック
    const hasPartnerPermission = await hasPermission(currentUser.id, "systemSettings", "managePartners");
    if (!hasPartnerPermission) {
      console.log("Partner management permission check failed");
      return NextResponse.json({ error: "パートナー管理権限がありません" }, { status: 403 });
    }

    const requestData = await request.json();
    console.log("Received request data:", requestData);
    
    const {
      name,
      userIdPrefix,
      address,
      phoneNumber,
      email,
      contactPerson,
      contractStartDate,
      contractEndDate,
      notes,
      isActive
    } = requestData;

    // 対象パートナーの存在確認
    const existingPartner = await prisma.partner.findUnique({
      where: { id }
    });
    console.log("Existing partner:", existingPartner);

    if (!existingPartner) {
      console.log("Partner not found for ID:", id);
      return NextResponse.json({ error: "パートナー企業が見つかりません" }, { status: 404 });
    }

    if (!name || !name.trim()) {
      console.log("Validation failed: name is required");
      return NextResponse.json(
        { error: "会社名は必須です" },
        { status: 400 }
      );
    }

    if (!userIdPrefix || !userIdPrefix.trim() || userIdPrefix.trim().length !== 4) {
      console.log("Validation failed: userIdPrefix must be 4 characters", { userIdPrefix });
      return NextResponse.json(
        { error: "ユーザーIDプレフィックスは4文字必須です" },
        { status: 400 }
      );
    }

    // 名前の重複チェック（自分以外）
    if (name.trim() !== existingPartner.name) {
      const duplicatePartner = await prisma.partner.findFirst({
        where: { 
          name: name.trim(),
          id: { not: id }
        }
      });

      if (duplicatePartner) {
        return NextResponse.json(
          { error: "この会社名は既に使用されています" },
          { status: 400 }
        );
      }
    }

    // プレフィックスの重複チェック（自分以外）
    const newPrefix = userIdPrefix.trim().toUpperCase();
    const currentPrefix = existingPartner.userIdPrefix || '';
    console.log("Prefix comparison:", { newPrefix, currentPrefix });
    
    if (newPrefix !== currentPrefix) {
      try {
        console.log("Checking prefix duplicate for:", newPrefix);
        const { checkPrefixDuplicate } = await import("@/lib/userIdGenerator");
        const prefixExists = await checkPrefixDuplicate(newPrefix, id);
        console.log("Prefix duplicate check result:", prefixExists);
        
        if (prefixExists) {
          console.log("Prefix already exists");
          return NextResponse.json(
            { error: "このユーザーIDプレフィックスは既に使用されています" },
            { status: 400 }
          );
        }
      } catch (error) {
        console.log("Prefix duplicate check failed, continuing:", error);
      }
    }

    console.log("Updating partner with data:", {
      name: name.trim(),
      userIdPrefix: userIdPrefix.trim().toUpperCase(),
      address: address || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      contactPerson: contactPerson || null,
      contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
      notes: notes || null,
      isActive: isActive ?? true,
    });

    // パートナー企業更新
    console.log("About to update partner with data:");
    const updateData = {
      name: name.trim(),
      userIdPrefix: userIdPrefix.trim().toUpperCase(),
      address: address || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      contactPerson: contactPerson || null,
      contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
      notes: notes || null,
      isActive: isActive ?? true,
    };
    console.log("Update data:", updateData);
    
    const updatedPartner = await prisma.partner.update({
      where: { id },
      data: updateData,
    });

    console.log("Partner updated successfully:", updatedPartner);
    return NextResponse.json(updatedPartner);
  } catch (error) {
    console.error("パートナー企業更新エラー:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: `パートナー企業情報の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // パートナー管理権限をチェック
    const hasPartnerPermission = await hasPermission(currentUser.id, "systemSettings", "managePartners");
    if (!hasPartnerPermission) {
      return NextResponse.json({ error: "パートナー管理権限がありません" }, { status: 403 });
    }

    // 対象パートナーの存在確認
    const existingPartner = await prisma.partner.findUnique({
      where: { id },
      include: {
        users: true
      }
    });

    if (!existingPartner) {
      return NextResponse.json({ error: "パートナー企業が見つかりません" }, { status: 404 });
    }

    // 関連するユーザーがいるかチェック
    if (existingPartner.users.length > 0) {
      return NextResponse.json(
        { error: "この企業に所属するユーザーがいるため、削除できません" },
        { status: 400 }
      );
    }

    // パートナー企業削除
    await prisma.partner.delete({
      where: { id }
    });

    return NextResponse.json({ message: "パートナー企業を削除しました" });
  } catch (error) {
    console.error("パートナー企業削除エラー:", error);
    return NextResponse.json(
      { 
        error: "パートナー企業の削除に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}