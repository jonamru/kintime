"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

import PageAccessGuard from "@/components/PageAccessGuard";
import TimeBaseHeader from "@/components/TimeBaseHeader";
import { showAlert, showConfirm } from '@/lib/notification';
import { isUserAdmin, canBeManager } from "@/lib/clientPermissions";
export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // 検索・フィルタ用のstate
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    userId: "",
    name: "",
    email: "",
    password: "",
    customRoleId: "",
    partnerId: "",
    managerIds: [] as string[],
    birthDate: "",
    defaultLocation: "",
    gpsEnabled: true,
    wakeUpEnabled: false,
    departureEnabled: false,
  });
  const [showNewPartnerModal, setShowNewPartnerModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [systemSettings, setSystemSettings] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
    fetchPartners();
    fetchManagers();
    fetchCustomRoles();
    fetchSystemSettings();
  }, []);

  // フィルタリングロジック
  useEffect(() => {
    let filtered = users;

    // 検索フィルタ（名前、メール、ユーザーID）
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.userId && user.userId.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // ロールフィルタ
    if (roleFilter) {
      filtered = filtered.filter(user => user.customRoleId === roleFilter);
    }

    // 会社フィルタ
    if (partnerFilter) {
      if (partnerFilter === 'self') {
        filtered = filtered.filter(user => !user.partnerId);
      } else {
        filtered = filtered.filter(user => user.partnerId === partnerFilter);
      }
    }

    // ステータスフィルタ（機能設定による）
    if (statusFilter) {
      switch (statusFilter) {
        case 'gps_enabled':
          filtered = filtered.filter(user => user.gpsEnabled);
          break;
        case 'gps_disabled':
          filtered = filtered.filter(user => !user.gpsEnabled);
          break;
        case 'wakeup_enabled':
          filtered = filtered.filter(user => user.wakeUpEnabled);
          break;
        case 'departure_enabled':
          filtered = filtered.filter(user => user.departureEnabled);
          break;
      }
    }

    setFilteredUsers(filtered);
    setCurrentPage(1); // フィルタ変更時は1ページ目に戻る
  }, [users, searchTerm, roleFilter, partnerFilter, statusFilter]);

  // ページネーション計算
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // フィルタクリア関数
  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("");
    setPartnerFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users?details=true");
      if (response.ok) {
        const data = await response.json();
        console.log("取得したユーザーデータ:", data.users?.[0]); // デバッグログ
        setUsers(data.users || []);
      } else {
        console.error("API エラー:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("ユーザー取得エラー:", error);
    }
  };

  const fetchPartners = async () => {
    try {
      const response = await fetch("/api/admin/partners");
      if (response.ok) {
        const data = await response.json();
        setPartners(data.partners || data || []);
      }
    } catch (error) {
      console.error("パートナー取得エラー:", error);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await fetch("/api/admin/users?details=true");
      if (response.ok) {
        const data = await response.json();
        const usersArray = data.users || data || [];
        setManagers(usersArray.filter((user: any) => 
          user.customRole && canBeManager({ ...user, customRole: user.customRole })
        ));
      }
    } catch (error) {
      console.error("管理者取得エラー:", error);
    }
  };

  const fetchCustomRoles = async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (response.ok) {
        const data = await response.json();
        setCustomRoles(data || []);
      }
    } catch (error) {
      console.error("カスタムロール取得エラー:", error);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const response = await fetch("/api/admin/system-settings");
      if (response.ok) {
        const data = await response.json();
        setSystemSettings(data);
      }
    } catch (error) {
      console.error("システム設定取得エラー:", error);
    }
  };

  const updateUserSettings = async (userId: string, settings: any) => {
    setLoading(true);
    console.log("更新する設定:", { userId, ...settings }); // デバッグログ
    try {
      const response = await fetch("/api/admin/users/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          ...settings,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("更新結果:", result); // デバッグログ
        await fetchUsers();
        // ON/OFF切り替えにはメッセージを表示しない
      } else {
        console.error("設定更新エラー:", response.status, response.statusText);
        showAlert("設定の更新に失敗しました");
      }
    } catch (error) {
      console.error("設定更新例外:", error);
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (userId: string, field: string, currentValue: boolean) => {
    console.log(`Toggle ${field}: ${currentValue} -> ${!currentValue} for user ${userId}`);
    updateUserSettings(userId, { [field]: !currentValue });
  };

  const resetForm = () => {
    setFormData({
      userId: "",
      name: "",
      email: "",
      password: "",
      customRoleId: "",
      partnerId: "",
      managerIds: [],
      birthDate: "",
      defaultLocation: "",
      gpsEnabled: true,
      wakeUpEnabled: false,
      departureEnabled: false,
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
          partnerId: formData.partnerId || null,
          managerIds: formData.managerIds.length > 0 ? formData.managerIds : null,
          customRoleId: formData.customRoleId || null,
        }),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        showAlert("ユーザーを作成しました");
        fetchUsers();
        setShowCreateModal(false);
        resetForm();
      } else {
        showAlert(responseData.error || "ユーザー作成に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setFormData({
      userId: user.userId || "",
      name: user.name,
      email: user.email,
      password: "", // パスワードは空にしておく
      customRoleId: user.customRoleId || "",
      partnerId: user.partnerId || "",
      managerIds: user.managers ? user.managers.map((m: any) => m.id) : [],
      birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : "",
      defaultLocation: user.defaultLocation || "",
      gpsEnabled: user.gpsEnabled ?? true,
      wakeUpEnabled: user.wakeUpEnabled ?? false,
      departureEnabled: user.departureEnabled ?? false,
    });
    setShowEditModal(true);
  };

  const handleDeleteUser = async (user: any) => {
    if (!(await showConfirm(`本当に「${user.name}」を削除しますか？\nこの操作は取り消せません。`))) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showAlert("ユーザーを削除しました");
        fetchUsers();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "削除に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    setLoading(true);
    
    try {
      const updateData = {
        ...formData,
        birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
        partnerId: formData.partnerId || null,
        managerIds: formData.managerIds.length > 0 ? formData.managerIds : null,
        customRoleId: formData.customRoleId || null,
      };
      
      // パスワードが空の場合は送信しない
      if (!formData.password) {
        delete (updateData as any).password;
      }
      
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        showAlert("ユーザー情報を更新しました");
        fetchUsers();
        setShowEditModal(false);
        setSelectedUser(null);
        resetForm();
      } else {
        showAlert(responseData.error || "ユーザー情報の更新に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch("/api/admin/partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newPartnerName.trim() }),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        showAlert("パートナー企業を追加しました");
        fetchPartners();
        setShowNewPartnerModal(false);
        setNewPartnerName("");
      } else {
        showAlert(responseData.error || "パートナー企業の追加に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageAccessGuard page="adminUsers">
      <TimeBaseHeader />
      <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  新規ユーザー登録
                </button>
              </div>
            </div>

            {/* 検索・フィルタセクション */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* 検索ボックス */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    検索
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="名前、メール、ユーザーIDで検索"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* ロールフィルタ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    権限ロール
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">すべてのロール</option>
                    {customRoles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 会社フィルタ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    所属会社
                  </label>
                  <select
                    value={partnerFilter}
                    onChange={(e) => setPartnerFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">すべての会社</option>
                    <option value="self">自社</option>
                    {partners.map(partner => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ステータスフィルタ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    機能ステータス
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">すべてのステータス</option>
                    <option value="gps_enabled">GPS有効</option>
                    <option value="gps_disabled">GPS無効</option>
                    <option value="wakeup_enabled">起床報告有効</option>
                    <option value="departure_enabled">出発報告有効</option>
                  </select>
                </div>
              </div>

              {/* フィルタ情報とクリアボタン */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {filteredUsers.length} 件中 {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} 件を表示
                  {(searchTerm || roleFilter || partnerFilter || statusFilter) && (
                    <span className="ml-2">
                      (フィルタ適用中: 全 {users.length} 件)
                    </span>
                  )}
                </div>
                {(searchTerm || roleFilter || partnerFilter || statusFilter) && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    フィルタをクリア
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザーID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      権限
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      所属会社
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      担当管理者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      生年月日
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      GPS取得
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      起床報告
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      出発報告
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      デフォルト勤務地
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {(searchTerm || roleFilter || partnerFilter || statusFilter) 
                              ? 'フィルタ条件に一致するユーザーが見つかりません'
                              : 'ユーザーが登録されていません'
                            }
                          </h3>
                          <p className="text-gray-500 mb-4">
                            {(searchTerm || roleFilter || partnerFilter || statusFilter)
                              ? 'フィルタ条件を変更するか、フィルタをクリアしてください。'
                              : '新規ユーザー登録ボタンから最初のユーザーを作成してください。'
                            }
                          </p>
                          {(searchTerm || roleFilter || partnerFilter || statusFilter) && (
                            <button
                              onClick={clearFilters}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              フィルタをクリア
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.userId || "未設定"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {user.customRole?.displayName || '未設定'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.partner ? user.partner.name : '自社'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.managers && user.managers.length > 0 
                          ? user.managers.map((manager: any) => manager.name).join(', ') 
                          : '未設定'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.birthDate ? new Date(user.birthDate).toLocaleDateString('ja-JP') : '未設定'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggle(user.id, 'gpsEnabled', user.gpsEnabled ?? true)}
                          disabled={loading}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            (user.gpsEnabled ?? true) ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              (user.gpsEnabled ?? true) ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggle(user.id, 'wakeUpEnabled', user.wakeUpEnabled ?? false)}
                          disabled={loading}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            (user.wakeUpEnabled ?? false) ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              (user.wakeUpEnabled ?? false) ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggle(user.id, 'departureEnabled', user.departureEnabled ?? false)}
                          disabled={loading}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            (user.departureEnabled ?? false) ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              (user.departureEnabled ?? false) ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editingUserId === user.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingLocation}
                              onChange={(e) => setEditingLocation(e.target.value)}
                              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="例: 大阪オフィス"
                            />
                            <button
                              onClick={() => {
                                updateUserSettings(user.id, { defaultLocation: editingLocation });
                                setEditingUserId(null);
                              }}
                              className="text-green-600 hover:text-green-900 text-sm"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="text-gray-600 hover:text-gray-900 text-sm"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span>{user.defaultLocation || "未設定"}</span>
                            <button
                              onClick={() => {
                                setEditingUserId(user.id);
                                setEditingLocation(user.defaultLocation || "");
                              }}
                              className="ml-2 text-indigo-600 hover:text-indigo-900 text-sm"
                            >
                              編集
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            編集
                          </button>
                          {currentUser && currentUser.customRole?.name === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="text-red-600 hover:text-red-900"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 border-t border-gray-200">
                <div className="flex flex-1 justify-between sm:hidden">
                  {/* モバイル版ページネーション */}
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    前へ
                  </button>
                  <span className="text-sm text-gray-700 flex items-center">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    次へ
                  </button>
                </div>
                
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{filteredUsers.length}</span> 件中{' '}
                      <span className="font-medium">{startIndex + 1}</span> - {' '}
                      <span className="font-medium">{Math.min(endIndex, filteredUsers.length)}</span> 件を表示
                    </p>
                  </div>
                  
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      {/* 前のページボタン */}
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {/* ページ番号ボタン */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // 現在のページの前後2ページまでを表示
                          return Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages;
                        })
                        .map((page, index, arr) => {
                          // ... で省略表示
                          if (index > 0 && page - arr[index - 1] > 1) {
                            return (
                              <span key={`ellipsis-${page}`} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                              </span>
                            );
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                page === currentPage
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      
                      {/* 次のページボタン */}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    設定の説明
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>GPS取得:</strong> 勤怠打刻時に位置情報を取得するかどうか</li>
                      <li><strong>起床報告:</strong> 起床報告ボタンを表示するかどうか</li>
                      <li><strong>出発報告:</strong> 出発報告ボタンを表示するかどうか</li>
                      <li><strong>デフォルト勤務地:</strong> 常勤シフト申請時に自動表示される勤務地</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 新規ユーザー作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">新規ユーザー登録</h3>
                    <p className="text-emerald-100 text-sm">新しいメンバーをシステムに追加</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              <form onSubmit={handleCreateUser} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 左カラム - 基本情報 */}
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-blue-900">基本情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ユーザーID
                          </label>
                          <input
                            type="text"
                            value={systemSettings?.companyUserIdPrefix ? `${systemSettings.companyUserIdPrefix}XXXX` : formData.userId}
                            readOnly={!!systemSettings?.companyUserIdPrefix}
                            onChange={!systemSettings?.companyUserIdPrefix ? (e) => setFormData(prev => ({ ...prev, userId: e.target.value })) : undefined}
                            className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200 ${systemSettings?.companyUserIdPrefix ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`}
                            placeholder={systemSettings?.companyUserIdPrefix ? `${systemSettings.companyUserIdPrefix}から始まる自動生成ID` : "例: user001"}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            名前 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="フルネームを入力"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            メールアドレス <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="example@company.com"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            初期パスワード <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="8文字以上の安全なパスワード"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">ユーザーは初回ログイン後にパスワード変更を推奨</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            生年月日
                          </label>
                          <input
                            type="date"
                            value={formData.birthDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右カラム - 権限・所属情報 */}
                  <div className="space-y-6">
                    <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-purple-900">権限・所属情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            権限ロール <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.customRoleId}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, customRoleId: e.target.value }));
                            }}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                            required
                          >
                            <option value="">ロールを選択してください</option>
                            {customRoles.map(role => (
                              <option key={role.id} value={role.id}>
                                {role.displayName}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            所属会社
                          </label>
                          <select
                            value={formData.partnerId}
                            onChange={(e) => setFormData(prev => ({ ...prev, partnerId: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                          >
                            <option value="">自社</option>
                            {partners.map(partner => (
                              <option key={partner.id} value={partner.id}>{partner.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* 担当管理者選択 - プルダウン形式 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            担当管理者
                          </label>
                          
                          {/* 選択済み管理者の表示 */}
                          {formData.managerIds.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-600 mb-2">選択済み ({formData.managerIds.length}名)</p>
                              <div className="flex flex-wrap gap-2">
                                {formData.managerIds.map(managerId => {
                                  const manager = managers.find(m => m.id === managerId);
                                  return manager ? (
                                    <span
                                      key={managerId}
                                      className="inline-flex items-center bg-emerald-100 text-emerald-800 text-xs font-medium px-3 py-1 rounded-full"
                                    >
                                      {manager.name}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormData(prev => ({
                                            ...prev,
                                            managerIds: prev.managerIds.filter(id => id !== managerId)
                                          }));
                                        }}
                                        className="ml-2 hover:text-emerald-600"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}

                          {/* プルダウン選択 */}
                          <select
                            value=""
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              if (selectedId && !formData.managerIds.includes(selectedId)) {
                                setFormData(prev => ({
                                  ...prev,
                                  managerIds: [...prev.managerIds, selectedId]
                                }));
                              }
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option value="">管理者を選択してください</option>
                            {managers.filter(manager => !formData.managerIds.includes(manager.id)).map(manager => (
                              <option key={manager.id} value={manager.id}>
                                {manager.name} ({manager.email})
                              </option>
                            ))}
                          </select>
                          
                          {managers.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">管理者権限を持つユーザーがいません</p>
                          )}
                          
                          {formData.managerIds.length === managers.length && managers.length > 0 && (
                            <p className="text-xs text-emerald-600 mt-1">全ての管理者が選択済みです</p>
                          )}
                        </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            デフォルト勤務地
                          </label>
                          <input
                            type="text"
                            value={formData.defaultLocation}
                            onChange={(e) => setFormData(prev => ({ ...prev, defaultLocation: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 大阪オフィス, 東京本社"
                          />
                          <p className="text-xs text-gray-500 mt-1">常勤シフト申請時に自動表示される勤務地</p>
                        </div>
                      </div>
                    </div>

                {/* アクションボタン */}
                <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        作成中...
                      </div>
                    ) : (
                      "ユーザーを作成"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ユーザー編集モーダル */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">ユーザー情報編集</h3>
                    <p className="text-blue-100 text-sm">{selectedUser.name} の情報を編集</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                    resetForm();
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              <form onSubmit={handleUpdateUser} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 左カラム - 基本情報 */}
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-blue-900">基本情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ユーザーID
                          </label>
                          <input
                            type="text"
                            value={formData.userId}
                            onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: user001"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            名前 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            メールアドレス <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            新しいパスワード（変更する場合のみ）
                          </label>
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="変更しない場合は空のままにしてください"
                          />
                          <p className="text-xs text-gray-500 mt-1">空の場合は現在のパスワードが維持されます</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            生年月日
                          </label>
                          <input
                            type="date"
                            value={formData.birthDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右カラム - 権限・所属情報・設定 */}
                  <div className="space-y-6">
                    <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-purple-900">権限・所属情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            権限ロール <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.customRoleId}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, customRoleId: e.target.value }));
                            }}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                            required
                          >
                            <option value="">ロールを選択してください</option>
                            {customRoles.map(role => (
                              <option key={role.id} value={role.id}>
                                {role.displayName}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            所属会社
                          </label>
                          <select
                            value={formData.partnerId}
                            onChange={(e) => setFormData(prev => ({ ...prev, partnerId: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                          >
                            <option value="">自社</option>
                            {partners.map(partner => (
                              <option key={partner.id} value={partner.id}>{partner.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* 担当管理者選択 - プルダウン形式 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            担当管理者
                          </label>
                          
                          {/* 選択済み管理者の表示 */}
                          {formData.managerIds.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-600 mb-2">選択済み ({formData.managerIds.length}名)</p>
                              <div className="flex flex-wrap gap-2">
                                {formData.managerIds.map(managerId => {
                                  const manager = managers.find(m => m.id === managerId);
                                  return manager ? (
                                    <span
                                      key={managerId}
                                      className="inline-flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full"
                                    >
                                      {manager.name}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormData(prev => ({
                                            ...prev,
                                            managerIds: prev.managerIds.filter(id => id !== managerId)
                                          }));
                                        }}
                                        className="ml-2 hover:text-blue-600"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}

                          {/* プルダウン選択 */}
                          <select
                            value=""
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              if (selectedId && !formData.managerIds.includes(selectedId)) {
                                setFormData(prev => ({
                                  ...prev,
                                  managerIds: [...prev.managerIds, selectedId]
                                }));
                              }
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">管理者を選択してください</option>
                            {managers
                              .filter(manager => manager.id !== selectedUser?.id && !formData.managerIds.includes(manager.id))
                              .map(manager => (
                                <option key={manager.id} value={manager.id}>
                                  {manager.name} ({manager.email})
                                </option>
                              ))}
                          </select>
                          
                          {managers.filter(manager => manager.id !== selectedUser?.id).length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">選択可能な管理者がいません</p>
                          )}
                          
                          {formData.managerIds.length === managers.filter(manager => manager.id !== selectedUser?.id).length && 
                           managers.filter(manager => manager.id !== selectedUser?.id).length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">選択可能な全ての管理者が選択済みです</p>
                          )}
                        </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            デフォルト勤務地
                          </label>
                          <input
                            type="text"
                            value={formData.defaultLocation}
                            onChange={(e) => setFormData(prev => ({ ...prev, defaultLocation: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 大阪オフィス, 東京本社"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 機能設定 */}
                    <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-green-900">機能設定</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <label className="flex items-center p-3 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-150 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.gpsEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, gpsEnabled: e.target.checked }))}
                            className="rounded border-green-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 mr-3"
                          />
                          <div>
                            <p className="font-medium text-green-900">GPS取得を有効にする</p>
                            <p className="text-sm text-green-700">勤怠打刻時に位置情報を取得</p>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-3 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-150 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.wakeUpEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, wakeUpEnabled: e.target.checked }))}
                            className="rounded border-green-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 mr-3"
                          />
                          <div>
                            <p className="font-medium text-green-900">起床報告を有効にする</p>
                            <p className="text-sm text-green-700">起床報告ボタンを表示</p>
                          </div>
                        </label>
                        
                        <label className="flex items-center p-3 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-150 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.departureEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, departureEnabled: e.target.checked }))}
                            className="rounded border-green-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 mr-3"
                          />
                          <div>
                            <p className="font-medium text-green-900">出発報告を有効にする</p>
                            <p className="text-sm text-green-700">出発報告ボタンを表示</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                {/* アクションボタン */}
                <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedUser(null);
                      resetForm();
                    }}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        更新中...
                      </div>
                    ) : (
                      "更新"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 新しいパートナー企業追加モーダル */}
      {showNewPartnerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">新規パートナー企業登録</h3>
                    <p className="text-orange-100 text-sm">新しいパートナー企業をシステムに追加</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowNewPartnerModal(false);
                    setNewPartnerName("");
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="p-8">
              <form onSubmit={handleCreatePartner} className="space-y-6">
                {/* 企業情報セクション */}
                <div className="bg-orange-50 rounded-xl p-6 border border-orange-100">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-orange-900">企業情報</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        会社名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:ring-0 transition-all duration-200"
                        placeholder="例: 株式会社サンプル, Sample Corporation"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">正式な会社名を入力してください</p>
                    </div>
                  </div>
                </div>

                {/* 説明セクション */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-blue-900 mb-1">パートナー企業について</h5>
                      <p className="text-sm text-blue-800">
                        パートナー企業は、TimeBaseシステムを利用する外部企業です。<br />
                        登録後、この会社に所属するユーザーを作成できるようになります。
                      </p>
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewPartnerModal(false);
                      setNewPartnerName("");
                    }}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !newPartnerName.trim()}
                    className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        登録中...
                      </div>
                    ) : (
                      "パートナー企業を登録"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>

    </PageAccessGuard>
  );
}