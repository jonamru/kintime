"use client";

import { useAuth } from "./AuthProvider";

import { showConfirm } from '@/lib/notification';
export default function LogoutButton({ className = "" }: { className?: string }) {
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (await showConfirm("ログアウトしますか？")) {
      await logout();
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={`text-red-600 hover:text-red-800 ${className}`}
    >
      ログアウト
    </button>
  );
}