import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    // ページネーションパラメータを取得
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const skip = (page - 1) * limit;
    
    console.log("パートナー取得 ページネーションパラメータ:", { page, limit, search, skip });
    
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

    // 検索・フィルタ条件を設定
    const whereCondition: any = { isActive: true };
    
    if (search) {
      whereCondition.OR = [
        { name: { contains: search } },
        { userIdPrefix: { contains: search } },
        { email: { contains: search } },
        { contactPerson: { contains: search } }
      ];
    }

    // 総件数を取得
    const totalCount = await prisma.partner.count({
      where: whereCondition,
    });

    const partners = await prisma.partner.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { name: 'asc' }
    });

    // ページネーション情報を含めてレスポンス
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      partners,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("パートナー取得エラー:", error);
    return NextResponse.json(
      { error: "パートナー情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log("Partner creation request received");
    
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

    // 会社名の重複チェック
    console.log("Checking for duplicate company name:", name.trim());
    const existingPartner = await prisma.partner.findFirst({
      where: { name: name.trim() }
    });

    if (existingPartner) {
      console.log("Company name already exists");
      return NextResponse.json(
        { error: "この会社名は既に登録されています" },
        { status: 400 }
      );
    }

    // プレフィックスの重複チェック
    console.log("Checking prefix duplicate for:", userIdPrefix.trim().toUpperCase());
    try {
      const { checkPrefixDuplicate } = await import("@/lib/userIdGenerator");
      const prefixExists = await checkPrefixDuplicate(userIdPrefix.trim().toUpperCase());
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

    console.log("About to create partner with data:");
    const createData = {
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
    console.log("Create data:", createData);

    const newPartner = await prisma.partner.create({
      data: createData,
    });

    console.log("Partner created successfully:", newPartner);
    return NextResponse.json(newPartner);
  } catch (error) {
    console.error("パートナー作成エラー:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: `パートナー企業の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}