
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        // 1. 認証チェック
        const currentUser = await getCurrentUser(request);
        if (!currentUser) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { filename } = await params;

        // セキュリティ対策（ディレクトリトラバーサル防止）
        const safeFilename = path.basename(filename);
        const filePath = path.join(process.cwd(), "private-uploads", safeFilename);

        try {
            const fileBuffer = await readFile(filePath);

            // Content-Typeの決定
            const ext = path.extname(safeFilename).toLowerCase();
            const contentType = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
            }[ext] || 'application/octet-stream';

            return new NextResponse(new Blob([new Uint8Array(fileBuffer)]), {
                headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "private, max-age=3600" // ブラウザキャッシュを許可（認証済みユーザーのみ）
                },
            });
        } catch (error) {
            console.error("ファイル読み込みエラー:", error);
            return new NextResponse("Not Found", { status: 404 });
        }
    } catch (error) {
        console.error("画像配信エラー:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
