// ページアクセス権限の設定情報
export const PAGE_ACCESS_CONFIG = {
  // 基本機能
  dashboard: { label: "ダッシュボード", category: "basic" },
  attendance: { label: "打刻", category: "basic" },
  attendanceHistory: { label: "勤怠履歴", category: "basic" },
  
  // シフト管理
  shiftRequest: { label: "シフト申請", category: "shift" },
  shiftWorkers: { label: "出勤者管理", category: "shift" },
  shiftOverview: { label: "シフト一覧", category: "shift" },
  shiftRegister: { label: "シフト登録", category: "shift" },
  shiftLock: { label: "登録ロック管理", category: "shift" },
  
  // 経費管理
  expense: { label: "経費申請", category: "expense" },
  expenseMonthly: { label: "月次経費一覧", category: "expense" },
  
  // 管理機能
  reports: { label: "レポート", category: "management" },
  adminUsers: { label: "ユーザー管理", category: "management" },
  adminPartners: { label: "パートナー管理", category: "management" },
  adminSystem: { label: "システム設定", category: "management" },
  bulkEdit: { label: "一括修正管理", category: "management" },
} as const;

export const CATEGORIES = {
  basic: { label: "基本機能", icon: "🏠" },
  shift: { label: "シフト管理", icon: "📅" },
  expense: { label: "経費管理", icon: "💰" },
  management: { label: "レポート・管理", icon: "⚙️" }
} as const;

export type PageAccessKey = keyof typeof PAGE_ACCESS_CONFIG;
export type CategoryKey = keyof typeof CATEGORIES;