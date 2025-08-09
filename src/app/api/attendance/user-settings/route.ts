import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request as any);
    
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.customRole?.name || "",
      partnerId: user.partnerId,
      partner: user.partner,
      gpsEnabled: user.gpsEnabled,
      wakeUpEnabled: user.wakeUpEnabled,
      departureEnabled: user.departureEnabled,
      defaultLocation: user.defaultLocation,
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