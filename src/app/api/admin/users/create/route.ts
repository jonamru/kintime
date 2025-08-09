import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    // 認証チェック
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ユーザー作成権限をチェック
    const hasCreatePermission = await hasPermission(currentUser.id, "userManagement", "create");
    if (!hasCreatePermission) {
      return NextResponse.json({ error: "ユーザー作成権限がありません" }, { status: 403 });
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

    // 必須フィールドの検証
    if (!name || !email || !password || !customRoleId) {
      return NextResponse.json(
        { error: "名前、メールアドレス、パスワード、権限は必須です" },
        { status: 400 }
      );
    }

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に使用されています" },
        { status: 400 }
      );
    }

    // ユーザーIDの処理
    let finalUserId = userId;
    
    if (!userId || !userId.trim() || userId.includes('XXXX')) {
      // ユーザーIDが未入力、または自動生成プレースホルダーの場合は自動生成
      const { generateUserId } = await import("@/lib/userIdGenerator");
      finalUserId = await generateUserId(partnerId);
    } else {
      // 手動入力の場合は重複チェック
      const existingUserById = await prisma.user.findUnique({
        where: { userId: userId.trim() }
      });

      if (existingUserById) {
        return NextResponse.json(
          { error: "このユーザーIDは既に使用されています" },
          { status: 400 }
        );
      }
      finalUserId = userId.trim();
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザー作成
    const newUser = await prisma.user.create({
      data: {
        userId: finalUserId,
        name,
        email,
        password: hashedPassword,
        customRoleId: customRoleId,
        partnerId: partnerId || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        defaultLocation: defaultLocation || null,
        gpsEnabled: gpsEnabled ?? true,
        wakeUpEnabled: wakeUpEnabled ?? false,
        departureEnabled: departureEnabled ?? false,
        managers: managerIds && managerIds.length > 0 ? {
          connect: managerIds.map((id: string) => ({ id }))
        } : undefined,
      },
      include: {
        partner: true,
        managers: true,
        customRole: true,
      },
    });

    // パスワードを除外してレスポンス
    const { password: _, ...userResponse } = newUser;

    return NextResponse.json(userResponse);
  } catch (error) {
    console.error("ユーザー作成エラー:", error);
    return NextResponse.json(
      { error: "ユーザーの作成に失敗しました" },
      { status: 500 }
    );
  }
}