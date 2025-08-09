"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { showNotification, showConfirm } from "@/lib/notification";
import Link from "next/link";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import PageAccessGuard from "@/components/PageAccessGuard";
interface SystemSettings {
  id?: string;
  companyName?: string;
  companyUserIdPrefix?: string;
  headerCopyright?: string;
}

interface CustomRole {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  permissions: any;
  pageAccess: any;
}

export default function SystemAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({});
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  useEffect(() => {
    fetchSystemSettings();
    fetchRoles();
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const response = await fetch("/api/admin/system-settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data || {});
      }
    } catch (error) {
      console.error("システム設定取得エラー:", error);
      showNotification("システム設定の取得に失敗しました", "error");
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("ロール取得エラー:", error);
      showNotification("ロールの取得に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveSystemSettings = async () => {
    setSaving(true);
    try {
      console.log("保存データ:", settings);
      const response = await fetch("/api/admin/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        showNotification("システム設定を保存しました");
        await fetchSystemSettings();
      } else {
        const error = await response.json();
        showNotification(error.error || "保存に失敗しました", "error");
      }
    } catch (error) {
      console.error("保存エラー:", error);
      showNotification("保存中にエラーが発生しました", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleEdit = (role: CustomRole) => {
    setSelectedRole({ ...role });
    setIsEditingRole(true);
    setIsCreatingRole(false);
  };

  const handleRoleCreate = () => {
    setSelectedRole({
      id: "",
      name: "",
      displayName: "",
      isSystem: false,
      permissions: {
        userManagement: {
          create: false,
          edit: false,
          delete: false,
          viewAll: false,
          viewAssigned: false,
          editAssigned: false,
        },
        shiftManagement: {
          approve: false,
          edit: false,
          delete: false,
          viewAll: false,
          viewCompany: false,
          forceRegister: false,
          lockUnlock: false,
          viewAssigned: false,
          editAssigned: false,
        },
        attendanceManagement: {
          viewAll: false,
          viewCompany: false,
          forceClockInOut: false,
          editOthers: false,
          viewAssigned: false,
          editAssigned: false,
        },
        expenseManagement: {
          approve: false,
          viewAll: false,
          viewCompany: false,
          lock: false,
          delete: false,
          ignoreDeadline: false,
          viewAssigned: false,
          editAssigned: false,
        },
        systemSettings: {
          manageCompany: false,
          manageRoles: false,
          managePartners: false,
        },
      },
      pageAccess: {
        dashboard: true,
        attendance: true,
        attendanceHistory: true,
        shiftRequest: true,
        shiftWorkers: false,
        shiftOverview: false,
        shiftRegister: false,
        shiftLock: false,
        expense: true,
        expenseMonthly: true,
        reports: false,
        adminUsers: false,
        adminPartners: false,
        adminSystemSettings: false,
        adminSystem: false,
        bulkEdit: false,
      },
    });
    setIsEditingRole(true);
    setIsCreatingRole(true);
  };

  const saveRole = async () => {
    if (!selectedRole) return;

    try {
      const url = isCreatingRole ? "/api/admin/roles" : `/api/admin/roles/${selectedRole.id}`;
      const method = isCreatingRole ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedRole),
      });

      if (response.ok) {
        showNotification(isCreatingRole ? "ロールを作成しました" : "ロールを更新しました");
        await fetchRoles();
        setIsEditingRole(false);
        setSelectedRole(null);
      } else {
        const error = await response.json();
        showNotification(error.error || "保存に失敗しました", "error");
      }
    } catch (error) {
      console.error("ロール保存エラー:", error);
      showNotification("保存中にエラーが発生しました", "error");
    }
  };

  const deleteRole = async (role: CustomRole) => {
    if (role.isSystem) {
      showNotification("システムロールは削除できません", "error");
      return;
    }

    const confirmed = await showConfirm(`ロール「${role.displayName}」を削除しますか？`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showNotification("ロールを削除しました");
        await fetchRoles();
      } else {
        const error = await response.json();
        showNotification(error.error || "削除に失敗しました", "error");
      }
    } catch (error) {
      console.error("ロール削除エラー:", error);
      showNotification("削除中にエラーが発生しました", "error");
    }
  };

  if (loading) {
    return (
      <PageAccessGuard page="adminSystem">
        <div className="min-h-screen bg-gray-100">
        <div className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">読み込み中...</div>
          </div>
        </div>
        </div>
      </PageAccessGuard>
    );
  }

  return (
    <PageAccessGuard page="adminSystem">
      <TimeBaseHeader 
        rightAction={
          <Link href="/dashboard" className="inline-flex items-center px-3 py-2 md:px-4 md:py-2 border border-transparent text-xs md:text-sm font-medium rounded-lg text-white bg-[#4A90E2] hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A90E2] transition-all duration-200 shadow-lg hover:shadow-xl">
            <svg className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="hidden sm:inline">ダッシュボード</span>
            <span className="sm:hidden">ホーム</span>
          </Link>
        }
      />
      <div className="min-h-screen bg-gray-100">
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold leading-tight text-gray-900">
                システム管理
              </h1>
            </div>
          </div>
        </header>

        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            {/* 会社情報設定 */}
            <div className="bg-white shadow rounded-lg mt-8 p-6">
              <h2 className="text-xl font-semibold mb-4">会社情報設定</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    会社名
                  </label>
                  <input
                    type="text"
                    value={settings.companyName || ""}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="株式会社○○"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ユーザーIDプレフィックス
                  </label>
                  <input
                    type="text"
                    value={settings.companyUserIdPrefix || ""}
                    onChange={(e) => setSettings({ ...settings, companyUserIdPrefix: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="例: COMP"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    ユーザーIDは「プレフィックス-連番」の形式になります
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ヘッダーコピーライト
                  </label>
                  <input
                    type="text"
                    value={settings.headerCopyright || ""}
                    onChange={(e) => setSettings({ ...settings, headerCopyright: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="© 2024 Company Name. All rights reserved."
                  />
                </div>

                <button
                  onClick={saveSystemSettings}
                  disabled={saving}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>

            {/* ロール管理 */}
            <div className="bg-white shadow rounded-lg mt-8 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">ロール管理</h2>
                <button
                  onClick={handleRoleCreate}
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  新規ロール作成
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ロール名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        表示名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        種別
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {roles.map((role) => (
                      <tr key={role.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {role.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {role.displayName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {role.isSystem ? "システム" : "カスタム"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleRoleEdit(role)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            編集
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => deleteRole(role)}
                              className="text-red-600 hover:text-red-900"
                            >
                              削除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ロール編集モーダル */}
            {isEditingRole && selectedRole && (
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {isCreatingRole ? "新規ロール作成" : "ロール編集"}
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          ロール名（英字）
                        </label>
                        <input
                          type="text"
                          value={selectedRole.name}
                          onChange={(e) => setSelectedRole({ ...selectedRole, name: e.target.value })}
                          disabled={!isCreatingRole}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
                          placeholder="CUSTOM_ROLE"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          表示名
                        </label>
                        <input
                          type="text"
                          value={selectedRole.displayName}
                          onChange={(e) => setSelectedRole({ ...selectedRole, displayName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="カスタムロール"
                        />
                      </div>
                    </div>

                    {/* 権限設定 */}
                    <div className="border-t pt-6">
                      <h4 className="text-lg font-semibold mb-4 text-gray-900">権限設定</h4>
                      <p className="text-sm text-gray-600 mb-6">このロールに付与する権限を選択してください。権限レベルは高い順に適用されます。</p>
                      
                      <div className="grid gap-6">
                        {/* ユーザー管理権限 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                              </svg>
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">ユーザー管理</h5>
                              <p className="text-xs text-gray-600">スタッフアカウントの管理に関する権限</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(selectedRole.permissions.userManagement).map(([key, value]) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={value as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    permissions: {
                                      ...selectedRole.permissions,
                                      userManagement: {
                                        ...selectedRole.permissions.userManagement,
                                        [key]: e.target.checked,
                                      },
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "create" && "新規作成"}
                                    {key === "edit" && "編集"}
                                    {key === "delete" && "削除"}
                                    {key === "viewAll" && "全ユーザー閲覧"}
                                    {key === "viewAssigned" && "担当ユーザー閲覧"}
                                    {key === "editAssigned" && "担当ユーザー編集"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "create" && "新しいユーザーアカウントを作成"}
                                    {key === "edit" && "ユーザー情報を編集"}
                                    {key === "delete" && "ユーザーアカウントを削除"}
                                    {key === "viewAll" && "全ユーザーの情報を閲覧"}
                                    {key === "viewAssigned" && "自分が担当するユーザーのみ閲覧"}
                                    {key === "editAssigned" && "担当ユーザーの情報を編集"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* シフト管理権限 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">シフト管理</h5>
                              <p className="text-xs text-gray-600">勤務シフトの登録・承認に関する権限</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(selectedRole.permissions.shiftManagement).map(([key, value]) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={value as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    permissions: {
                                      ...selectedRole.permissions,
                                      shiftManagement: {
                                        ...selectedRole.permissions.shiftManagement,
                                        [key]: e.target.checked,
                                      },
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "approve" && "承認"}
                                    {key === "edit" && "編集"}
                                    {key === "delete" && "削除"}
                                    {key === "viewAll" && "全シフト閲覧"}
                                    {key === "viewCompany" && "社内シフト閲覧"}
                                    {key === "forceRegister" && "強制登録"}
                                    {key === "lockUnlock" && "ロック解除"}
                                    {key === "viewAssigned" && "担当シフト閲覧"}
                                    {key === "editAssigned" && "担当シフト編集"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "approve" && "シフト申請を承認・却下"}
                                    {key === "edit" && "シフト情報を編集"}
                                    {key === "delete" && "シフトを削除"}
                                    {key === "viewAll" && "全スタッフのシフトを閲覧"}
                                    {key === "viewCompany" && "同じ会社のスタッフのシフトのみ閲覧"}
                                    {key === "forceRegister" && "スタッフに代わってシフトを登録"}
                                    {key === "lockUnlock" && "シフト登録のロックを解除"}
                                    {key === "viewAssigned" && "担当スタッフのシフトのみ閲覧"}
                                    {key === "editAssigned" && "担当スタッフのシフトを編集"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 勤怠管理権限 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">勤怠管理</h5>
                              <p className="text-xs text-gray-600">出退勤の記録・管理に関する権限</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(selectedRole.permissions.attendanceManagement).map(([key, value]) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={value as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    permissions: {
                                      ...selectedRole.permissions,
                                      attendanceManagement: {
                                        ...selectedRole.permissions.attendanceManagement,
                                        [key]: e.target.checked,
                                      },
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "viewAll" && "全勤怠閲覧"}
                                    {key === "viewCompany" && "社内勤怠閲覧"}
                                    {key === "forceClockInOut" && "強制打刻"}
                                    {key === "editOthers" && "他人の勤怠編集"}
                                    {key === "viewAssigned" && "担当勤怠閲覧"}
                                    {key === "editAssigned" && "担当勤怠編集"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "viewAll" && "全スタッフの勤怠記録を閲覧"}
                                    {key === "viewCompany" && "同じ会社のスタッフの勤怠のみ閲覧"}
                                    {key === "forceClockInOut" && "スタッフに代わって出退勤を記録"}
                                    {key === "editOthers" && "他人の勤怠記録を修正"}
                                    {key === "viewAssigned" && "担当スタッフの勤怠のみ閲覧"}
                                    {key === "editAssigned" && "担当スタッフの勤怠を編集"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 経費管理権限 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">経費管理</h5>
                              <p className="text-xs text-gray-600">交通費・経費申請の管理に関する権限</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(selectedRole.permissions.expenseManagement).map(([key, value]) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={value as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    permissions: {
                                      ...selectedRole.permissions,
                                      expenseManagement: {
                                        ...selectedRole.permissions.expenseManagement,
                                        [key]: e.target.checked,
                                      },
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "approve" && "承認"}
                                    {key === "viewAll" && "全経費閲覧"}
                                    {key === "viewCompany" && "社内経費閲覧"}
                                    {key === "lock" && "ロック"}
                                    {key === "delete" && "削除"}
                                    {key === "ignoreDeadline" && "期限無視"}
                                    {key === "viewAssigned" && "担当経費閲覧"}
                                    {key === "editAssigned" && "担当経費編集"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "approve" && "経費申請を承認・却下"}
                                    {key === "viewAll" && "全スタッフの経費申請を閲覧"}
                                    {key === "viewCompany" && "同じ会社のスタッフの経費のみ閲覧"}
                                    {key === "lock" && "経費申請をロックして編集不可にする"}
                                    {key === "delete" && "経費申請を削除"}
                                    {key === "ignoreDeadline" && "申請期限を無視して編集"}
                                    {key === "viewAssigned" && "担当スタッフの経費のみ閲覧"}
                                    {key === "editAssigned" && "担当スタッフの経費を編集"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* システム設定権限 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">システム設定</h5>
                              <p className="text-xs text-gray-600">システム全体の設定・管理に関する権限</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {Object.entries(selectedRole.permissions.systemSettings).map(([key, value]) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={value as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    permissions: {
                                      ...selectedRole.permissions,
                                      systemSettings: {
                                        ...selectedRole.permissions.systemSettings,
                                        [key]: e.target.checked,
                                      },
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "manageCompany" && "会社情報管理"}
                                    {key === "manageRoles" && "ロール管理"}
                                    {key === "managePartners" && "パートナー管理"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "manageCompany" && "会社情報・システム設定の変更"}
                                    {key === "manageRoles" && "カスタムロールの作成・編集・削除"}
                                    {key === "managePartners" && "パートナー企業の管理"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ページアクセス権限 */}
                    <div className="border-t pt-6">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">ページアクセス権限</h4>
                          <p className="text-sm text-gray-600">各ページへのアクセス可否を設定</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 基本機能 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                              </svg>
                            </div>
                            <h5 className="font-medium text-gray-800">基本機能</h5>
                          </div>
                          <div className="space-y-2">
                            {["dashboard", "attendance", "attendanceHistory"].map((key) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={selectedRole.pageAccess[key as keyof typeof selectedRole.pageAccess] as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    pageAccess: {
                                      ...selectedRole.pageAccess,
                                      [key]: e.target.checked,
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "dashboard" && "ダッシュボード"}
                                    {key === "attendance" && "打刻"}
                                    {key === "attendanceHistory" && "勤怠履歴"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "dashboard" && "メイン画面への接続"}
                                    {key === "attendance" && "出退勤打刻機能"}
                                    {key === "attendanceHistory" && "個人の勤怠履歴確認"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* シフト管理 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <h5 className="font-medium text-gray-800">シフト管理</h5>
                          </div>
                          <div className="space-y-2">
                            {["shiftRequest", "shiftWorkers", "shiftOverview", "shiftRegister", "shiftLock"].map((key) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={selectedRole.pageAccess[key as keyof typeof selectedRole.pageAccess] as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    pageAccess: {
                                      ...selectedRole.pageAccess,
                                      [key]: e.target.checked,
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "shiftRequest" && "シフト申請"}
                                    {key === "shiftWorkers" && "出勤者管理"}
                                    {key === "shiftOverview" && "シフト一覧"}
                                    {key === "shiftRegister" && "シフト登録"}
                                    {key === "shiftLock" && "登録ロック管理"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "shiftRequest" && "個人のシフト希望申請"}
                                    {key === "shiftWorkers" && "本日の出勤者確認"}
                                    {key === "shiftOverview" && "全体のシフト状況確認"}
                                    {key === "shiftRegister" && "シフト登録・編集"}
                                    {key === "shiftLock" && "シフト登録のロック制御"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 経費管理 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-6 h-6 bg-orange-100 rounded flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <h5 className="font-medium text-gray-800">経費管理</h5>
                          </div>
                          <div className="space-y-2">
                            {["expense", "expenseMonthly"].map((key) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={selectedRole.pageAccess[key as keyof typeof selectedRole.pageAccess] as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    pageAccess: {
                                      ...selectedRole.pageAccess,
                                      [key]: e.target.checked,
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "expense" && "経費申請"}
                                    {key === "expenseMonthly" && "月次経費一覧"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "expense" && "交通費・経費の申請登録"}
                                    {key === "expenseMonthly" && "月別経費一覧・管理"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* レポート・管理機能 */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center mb-3">
                            <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <h5 className="font-medium text-gray-800">レポート・管理</h5>
                          </div>
                          <div className="space-y-2">
                            {["reports", "adminUsers", "adminPartners", "adminSystem", "bulkEdit"].map((key) => (
                              <label key={key} className="flex items-start space-x-3 p-2 rounded hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={selectedRole.pageAccess[key as keyof typeof selectedRole.pageAccess] as boolean}
                                  onChange={(e) => setSelectedRole({
                                    ...selectedRole,
                                    pageAccess: {
                                      ...selectedRole.pageAccess,
                                      [key]: e.target.checked,
                                    },
                                  })}
                                  className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700">
                                    {key === "reports" && "レポート"}
                                    {key === "adminUsers" && "ユーザー管理"}
                                    {key === "adminPartners" && "パートナー管理"}
                                    {key === "adminSystem" && "システム管理"}
                                    {key === "bulkEdit" && "一括修正管理"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {key === "reports" && "勤怠・経費レポートの閲覧"}
                                    {key === "adminUsers" && "ユーザー情報の管理"}
                                    {key === "adminPartners" && "パートナー企業の管理"}
                                    {key === "adminSystem" && "システム設定・ロール管理"}
                                    {key === "bulkEdit" && "勤怠・シフト・経費の一括修正"}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setIsEditingRole(false);
                        setSelectedRole(null);
                      }}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={saveRole}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>

    </PageAccessGuard>
  );
}