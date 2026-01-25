// Simplified Permission System Types
// スコープ（対象範囲）+ レベル（権限レベル）の2軸設計

export type PermissionScope = 'self' | 'assigned' | 'company' | 'all';
export type PermissionLevel = 'none' | 'view' | 'edit' | 'admin';
export type SystemPermissionLevel = 'none' | 'view' | 'admin';

export interface CategoryPermission {
    scope: PermissionScope;
    level: PermissionLevel;
}

export interface SystemSettingsPermission {
    level: SystemPermissionLevel;
}

export interface SimplifiedPermissions {
    shiftManagement: CategoryPermission;
    attendanceManagement: CategoryPermission;
    expenseManagement: CategoryPermission;
    userManagement: CategoryPermission;
    systemSettings: SystemSettingsPermission;
}

// スコープの優先順位（高いほど広い範囲）
export const SCOPE_ORDER: PermissionScope[] = ['self', 'assigned', 'company', 'all'];

// レベルの優先順位（高いほど強い権限）
export const LEVEL_ORDER: PermissionLevel[] = ['none', 'view', 'edit', 'admin'];

// 表示用ラベル
export const SCOPE_LABELS: Record<PermissionScope, string> = {
    self: '自分のみ',
    assigned: '担当者',
    company: '会社内',
    all: '全員',
};

export const LEVEL_LABELS: Record<PermissionLevel, string> = {
    none: 'なし',
    view: '閲覧',
    edit: '編集',
    admin: '管理',
};

export const SYSTEM_LEVEL_LABELS: Record<SystemPermissionLevel, string> = {
    none: 'なし',
    view: '閲覧',
    admin: '管理',
};

// カテゴリ情報
export const PERMISSION_CATEGORIES = [
    { key: 'shiftManagement', label: 'シフト管理', icon: 'calendar', hasScope: true },
    { key: 'attendanceManagement', label: '勤怠管理', icon: 'clock', hasScope: true },
    { key: 'expenseManagement', label: '経費管理', icon: 'wallet', hasScope: true },
    { key: 'userManagement', label: 'ユーザー管理', icon: 'users', hasScope: true },
    { key: 'systemSettings', label: 'システム設定', icon: 'settings', hasScope: false },
] as const;

// デフォルト権限（新規ロール作成時）
export const DEFAULT_PERMISSIONS: SimplifiedPermissions = {
    shiftManagement: { scope: 'self', level: 'view' },
    attendanceManagement: { scope: 'self', level: 'view' },
    expenseManagement: { scope: 'self', level: 'edit' },
    userManagement: { scope: 'self', level: 'none' },
    systemSettings: { level: 'none' },
};

// プリセットロール
export const PRESET_ROLES: Record<string, SimplifiedPermissions> = {
    STAFF: {
        shiftManagement: { scope: 'self', level: 'edit' },
        attendanceManagement: { scope: 'self', level: 'view' },
        expenseManagement: { scope: 'self', level: 'edit' },
        userManagement: { scope: 'self', level: 'none' },
        systemSettings: { level: 'none' },
    },
    TEAM_LEADER: {
        shiftManagement: { scope: 'assigned', level: 'admin' },
        attendanceManagement: { scope: 'assigned', level: 'edit' },
        expenseManagement: { scope: 'assigned', level: 'admin' },
        userManagement: { scope: 'assigned', level: 'view' },
        systemSettings: { level: 'none' },
    },
    MANAGER: {
        shiftManagement: { scope: 'company', level: 'admin' },
        attendanceManagement: { scope: 'company', level: 'edit' },
        expenseManagement: { scope: 'company', level: 'admin' },
        userManagement: { scope: 'company', level: 'edit' },
        systemSettings: { level: 'none' },
    },
    ADMIN: {
        shiftManagement: { scope: 'all', level: 'admin' },
        attendanceManagement: { scope: 'all', level: 'admin' },
        expenseManagement: { scope: 'all', level: 'admin' },
        userManagement: { scope: 'all', level: 'admin' },
        systemSettings: { level: 'admin' },
    },
    SUPER_ADMIN: {
        shiftManagement: { scope: 'all', level: 'admin' },
        attendanceManagement: { scope: 'all', level: 'admin' },
        expenseManagement: { scope: 'all', level: 'admin' },
        userManagement: { scope: 'all', level: 'admin' },
        systemSettings: { level: 'admin' },
    },
};
