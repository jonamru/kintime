import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 公開用のシステム設定API（認証不要）
// コピーライトなど公開可能な情報のみ返す
export async function GET() {
    try {
        const settings = await prisma.systemSetting.findFirst();

        if (!settings) {
            return NextResponse.json({
                headerCopyright: null,
                companyName: null,
            });
        }

        // 公開可能な情報のみ返す
        return NextResponse.json({
            headerCopyright: settings.headerCopyright || null,
            companyName: settings.companyName || null,
        });
    } catch (error) {
        console.error("公開システム設定取得エラー:", error);
        return NextResponse.json({
            headerCopyright: null,
            companyName: null,
        });
    }
}
