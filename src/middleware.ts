import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

// レート制限の設定
const limiter = rateLimit({
    interval: 60 * 1000, // 1分
    uniqueTokenPerInterval: 500, // トークン（IP）の最大数
});

export async function middleware(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const path = request.nextUrl.pathname;

    // レート制限のパラメータ
    let limit = 500; // デフォルト: 500回/分（緩和）
    let type = 'GLOBAL';

    // ログイン関連の厳格な制限
    if (path.startsWith('/api/auth/login')) {
        limit = 5; // ログイン試行: 5回/分
        type = 'LOGIN';
    }

    try {
        await limiter.check(limit, `${type}_${ip}`);

        // レスポンスヘッダーの設定（リクエスト処理後に追加するのが理想だが、ミドルウェアではここで通過させる）
        const response = NextResponse.next();
        response.headers.set('X-RateLimit-Limit', limit.toString());
        // Note: 正確な残り回数はLRUキャッシュから取得する必要があるが、簡易実装では省略

        return response;
    } catch {
        return NextResponse.json(
            { error: 'Too Many Requests', message: 'リクエスト回数が多すぎます。しばらく待ってから再試行してください。' },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }
}

export const config = {
    matcher: '/api/:path*',
};
