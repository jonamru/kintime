import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
    }

    // ファイルサイズチェック (5MB = 5 * 1024 * 1024 bytes)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは5MB以下にしてください" }, { status: 400 });
    }

    // ファイル形式チェック
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // file-typeを使用したマジックバイト検証
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!type || !allowedTypes.includes(type.mime)) {
      return NextResponse.json({ error: "対応していないファイル形式です。JPEG、PNG、GIF、WebPファイルをアップロードしてください" }, { status: 400 });
    }

    // ファイル名を生成 (タイムスタンプ + オリジナル名)
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // 特殊文字を_に置換
    const fileName = `${timestamp}_${originalName}`;

    // 環境変数から保存先を取得、なければデフォルトで private-uploads
    // セキュリティのため、Webから直接アクセスできないディレクトリに保存する
    const uploadDir = process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads");
    const filePath = path.join(uploadDir, fileName);

    console.log(`[Upload] Saving file to secure directory: ${filePath}`);

    // ファイルを保存
    await writeFile(filePath, buffer);

    // 公開URLを返す
    const fileUrl = `/uploads/${fileName}`;

    return NextResponse.json({
      message: "ファイルのアップロードが完了しました",
      url: fileUrl
    });
  } catch (error) {
    console.error("ファイルアップロードエラー:", error);
    return NextResponse.json({ error: "ファイルのアップロードに失敗しました" }, { status: 500 });
  }
}