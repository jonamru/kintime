"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface SystemSettings {
    headerCopyright?: string;
}

export default function Footer() {
    const [copyright, setCopyright] = useState<string>('');
    const pathname = usePathname();

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/public/settings');
                if (response.ok) {
                    const data: SystemSettings = await response.json();
                    setCopyright(data.headerCopyright || '');
                }
            } catch (error) {
                console.error('システム設定の取得に失敗:', error);
            }
        };

        fetchSettings();
    }, []);

    // ログイン画面ではフッターを表示しない
    if (pathname === '/login') {
        return null;
    }

    if (!copyright) {
        return null;
    }

    // スマホ版のみ表示 (md未満)
    return (
        <footer className="md:hidden bg-gray-50 border-t border-gray-200 py-3 px-4">
            <p className="text-center text-xs text-gray-500">
                {copyright}
            </p>
        </footer>
    );
}
