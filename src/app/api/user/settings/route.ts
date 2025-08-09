import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any);
    
    if (!currentUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    return NextResponse.json({
      id: currentUser.id,
      userId: currentUser.userId,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.customRole?.name || "",
      partnerId: currentUser.partnerId,
      partner: currentUser.partner,
      gpsEnabled: currentUser.gpsEnabled,
      wakeUpEnabled: currentUser.wakeUpEnabled,
      departureEnabled: currentUser.departureEnabled,
      defaultLocation: currentUser.defaultLocation,
    });
  } catch (error) {
    console.error("ユーザー設定取得エラー:", error);
    return NextResponse.json(
      { 
        error: "ユーザー設定の取得に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}