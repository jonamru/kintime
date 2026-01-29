import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

// 簡易MIMEタイプ判定
function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.pdf':
            return 'application/pdf';
        default:
            return 'application/octet-stream';
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;
        console.log(`[ImageRequest] Filename: ${filename}`);

        // 認証チェック
        const user = await getCurrentUser(request);
        if (!user) {
            console.log(`[ImageRequest] Unauthorized access attempt for ${filename}`);
            return new NextResponse(null, { status: 401 }); // Unauthorized
        }

        // パス・トラバーサル対策
        if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
            console.log(`[ImageRequest] Invalid filename: ${filename}`);
            return new NextResponse(null, { status: 400 });
        }

        // private-uploads ディレクトリからファイルを探す
        // 本番環境(Docker)では /app/private-uploads
        const privateUploadsDir = path.join(process.cwd(), "private-uploads");
        const filePath = path.join(privateUploadsDir, filename);

        console.log(`[ImageRequest] Looking for file at: ${filePath}`);

        try {
            await stat(filePath);
        } catch {
            console.log(`[ImageRequest] File not found: ${filePath}`);
            return new NextResponse(null, { status: 404 });
        }

        const fileBuffer = await readFile(filePath);
        const contentType = getMimeType(filePath);

        // レスポンスを返す
        // @ts-expect-error Buffer is valid BodyInit but types might be outdated
        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=3600",
            },
        });

    } catch (error) {
        console.error("画像配信エラー:", error);
        return new NextResponse(null, { status: 500 });
    }
}
