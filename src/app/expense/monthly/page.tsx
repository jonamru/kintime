"use client";

import { useState, useEffect, useCallback } from "react";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import { showAlert, showConfirm } from '@/lib/notification';
import { hasUserPermission } from "@/lib/clientPermissions";
import PageAccessGuard from "@/components/PageAccessGuard";
import { getJapanNow, formatJapanDate } from '@/lib/dateUtils';
import UserSearchCombobox from '@/components/UserSearchCombobox';

interface User {
  id: string;
  name: string;
  userId?: string;
  email?: string;
  partner?: { name: string };
  customRole?: {
    permissions?: {
      expenseManagement?: {
        ignoreDeadline?: boolean;
      };
    };
  };
}

interface Expense {
  id: string;
  date: string;
  type: string;
  amount: number;
  description?: string;
  status?: string;
  departure?: string;
  arrival?: string;
  validFrom?: string;
  validUntil?: string;
  route?: string;
  referenceUrl?: string;
  tripType?: string;
  isLocked?: boolean;
  imageUrl?: string;
  userId?: string;
  user?: {
    id?: string;
    name: string;
    userId?: string;
  };
  locker?: {
    name: string;
  };
}

export default function MonthlyExpensePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [_loading, setLoading] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        setCurrentUser(user);

        const userCanViewAll = hasUserPermission({ ...user, customRole: user.customRole }, 'expenseManagement', 'viewAll');
        const userCanViewAssigned = hasUserPermission({ ...user, customRole: user.customRole }, 'expenseManagement', 'viewAssigned');
        const userIsAdmin = userCanViewAll || userCanViewAssigned;

        setPermissions({
          canViewAll: userCanViewAll,
          canViewAssigned: userCanViewAssigned,
          isAdmin: userIsAdmin
        });

        if (!selectedUser) {
          if (!userCanViewAll && !userCanViewAssigned) {
            setSelectedUser(user.id);
          } else {
            setSelectedUser(user.id);
          }
        }
      }
    } catch (error: unknown) {
      console.error("ユーザー情報取得エラー:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error: unknown) {
      console.error("ユーザー取得エラー:", error);
    }
  };


  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [calendarDays, setCalendarDays] = useState<{ date: Date; day?: number; isCurrentMonth: boolean; dateString?: string; isToday?: boolean }[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('table');
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [permissions, setPermissions] = useState({ canViewAll: false, canViewAssigned: false, isAdmin: false });

  useEffect(() => {
    fetchCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // ユーザー情報が取得できてから users を取得
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser]);

  const fetchMonthlyExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      // 全ユーザー選択時（selectedUser が空文字）はuserIdパラメータを送らない
      let url = `/api/expenses/monthly?year=${year}&month=${month}`;
      if (selectedUser) {
        url += `&userId=${selectedUser}`;
      } else if (!permissions.isAdmin) { // Use permissions.isAdmin here
        // 管理者でない場合は自分のIDを送る
        url += `&userId=${currentUser?.id}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setExpenses(data.expenses || []);
        setMonthlyTotal(data.total || 0);
      }
    } catch (error: unknown) {
      console.error("月次経費取得エラー:", error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, selectedUser, currentUser, permissions.isAdmin]); // Add permissions.isAdmin to dependencies

  const _generateCalendar = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push({
        date: date,
        isCurrentMonth: date.getMonth() === month,
        dateString: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
        isToday: date.toDateString() === new Date().toDateString(),
      });
    }
    setCalendarDays(days);
  }, [currentMonth]);

  const navigateMonth = useCallback((direction: number) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  }, []);



  const getExpensesForDate = (dateString: string) => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const expenseDateString = `${expenseDate.getFullYear()}-${(expenseDate.getMonth() + 1).toString().padStart(2, '0')}-${expenseDate.getDate().toString().padStart(2, '0')}`;
      return expenseDateString === dateString;
    });
  };

  const getDayTotal = (dateString: string) => {
    const dayExpenses = getExpensesForDate(dateString);
    return dayExpenses.reduce((total, expense) => total + expense.amount, 0);
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  };

  // 権限情報はstateから取得（再計算を避ける）
  const { canViewAll: _canViewAll, canViewAssigned: _canViewAssigned, isAdmin } = permissions;

  // 編集モーダルを開く
  const openEditModal = (item: Expense) => {
    setEditingItem(item);
    setShowEditModal(true);
  };

  // ロック/アンロック操作
  const toggleLock = async (item: Expense, action: 'lock' | 'unlock') => {
    try {
      const endpoint = `/api/expenses/${item.id}`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        await fetchMonthlyExpenses(); // データを再取得
        showAlert(`${action === 'lock' ? 'ロック' : 'アンロック'}しました`);
      } else {
        const errorData = await response.json();
        showAlert(`操作に失敗しました: ${errorData.error}`);
      }
    } catch (error: unknown) {
      console.error('ロック操作エラー:', error);
      showAlert('操作中にエラーが発生しました');
    }
  };

  // 削除操作
  const deleteExpense = async (item: Expense & { departure?: string; arrival?: string }) => {
    if (!(await showConfirm(`${item.type === 'TRANSPORT' ? '交通費' : item.type === 'LODGING' ? '宿泊費' : '定期券'}を削除しますか？\n\n${item.departure ? `${item.departure} → ${item.arrival}` : item.description}\n金額: ¥${item.amount.toLocaleString()}`))) {
      return;
    }

    try {
      const response = await fetch(`/api/expenses/${item.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchMonthlyExpenses(); // データを再取得
        showAlert('削除しました');
      } else {
        const errorData = await response.json();
        showAlert(`削除に失敗しました: ${errorData.error}`);
      }
    } catch (error: unknown) {
      console.error('削除エラー:', error);
      showAlert('削除中にエラーが発生しました');
    }
  };

  const exportToCSV = () => {
    // 日付順にソート
    const sortedExpenses = expenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 選択されたユーザーの情報を取得
    const targetUser = selectedUser ? users.find(u => u.id === selectedUser) || currentUser : currentUser;

    let csvContent = '';
    const headers = ['日付', '曜日', '種別', '経路', '詳細路線', '金額', '参照URL'];

    if (isAdmin) {
      headers.splice(3, 0, 'ユーザー名', 'ユーザーID');
    }

    csvContent += headers.join(',') + '\n';

    sortedExpenses.forEach((expense) => {
      const expenseDate = new Date(expense.date);
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][expenseDate.getDay()];

      let dateStr, typeStr, routeStr, detailRouteStr, amountStr, urlStr;

      if (expense.type === 'COMMUTE_PASS') {
        dateStr = expense.validFrom && expense.validUntil ?
          `${new Date(expense.validFrom).toLocaleDateString('ja-JP')}〜${new Date(expense.validUntil).toLocaleDateString('ja-JP')}` :
          expense.validUntil ?
            `${expenseDate.toLocaleDateString('ja-JP')}〜${new Date(expense.validUntil).toLocaleDateString('ja-JP')}` :
            expenseDate.toLocaleDateString('ja-JP');
        typeStr = '定期券';
        routeStr = `${expense.departure} → ${expense.arrival}`;
        detailRouteStr = '';
        amountStr = expense.amount;
        urlStr = expense.imageUrl || '';
      } else {
        dateStr = expenseDate.toLocaleDateString('ja-JP');
        typeStr = expense.type === 'TRANSPORT' ? '交通費' : '宿泊費';
        routeStr = expense.type === 'TRANSPORT' ? `${expense.departure} → ${expense.arrival}` : expense.description;
        detailRouteStr = expense.route || '';
        amountStr = expense.amount;
        urlStr = expense.referenceUrl || '';
      }

      const row = [dateStr, dayOfWeek, typeStr, routeStr, detailRouteStr, amountStr, urlStr];

      if (isAdmin) {
        row.splice(3, 0, expense.user?.name || '-', expense.user?.userId || '-');
      }

      csvContent += row.map(field => `"${field}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    // ファイル名にユーザー情報を含める
    const userName = targetUser?.name || '';
    const userId = targetUser?.userId || targetUser?.id || '';
    const filename = `交通費・定期券_${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月_${userName}_${userId}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageAccessGuard page="expenseMonthly">
      <>
        <TimeBaseHeader
          rightAction={
            <a
              href="/dashboard"
              className="inline-flex items-center px-3 py-2 md:px-4 md:py-2 border border-transparent text-xs md:text-sm font-medium rounded-lg text-white bg-[#4A90E2] hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A90E2] transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden sm:inline">ダッシュボード</span>
              <span className="sm:hidden">ホーム</span>
            </a>
          }
        />
        {/* 編集モーダル */}
        {showEditModal && editingItem && (
          <EditModal
            item={editingItem}
            currentUser={currentUser}
            onClose={() => {
              setShowEditModal(false);
              setEditingItem(null);
            }}
            onUpdate={() => {
              fetchMonthlyExpenses();
              setShowEditModal(false);
              setEditingItem(null);
            }}
          />
        )}

        <div className="min-h-screen bg-gray-100 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">月次経費一覧</h1>
                  <p className="mt-2 text-sm text-gray-600">月毎の経費を日別で確認できます</p>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                {/* 月ナビゲーション（中央配置） */}
                <div className="flex justify-center items-center mb-4">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ← 前月
                  </button>
                  <h2 className="mx-6 text-lg font-semibold text-gray-900 min-w-0">
                    {formatMonth(currentMonth)}
                  </h2>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    次月 →
                  </button>
                </div>



                {/* ユーザー選択（管理者のみ）*/}
                {isAdmin && (
                  <div className="mb-4 max-w-xl mx-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ユーザー選択
                    </label>
                    <UserSearchCombobox
                      users={users}
                      selectedUserId={selectedUser}
                      onUserSelect={setSelectedUser}
                    />
                  </div>
                )}

                {/* 表示形式切り替え（デスクトップのみ）と合計金額 */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  {/* デスクトップのみ表示形式切り替えボタン */}
                  <div className="hidden md:flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('calendar')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      📅 カレンダー
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'table'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      📊 表形式
                    </button>
                  </div>

                  {/* モバイル用スペーサー */}
                  <div className="md:hidden"></div>

                  <div className="flex items-center space-x-3">
                    {expenses.length > 0 && (
                      <button
                        onClick={exportToCSV}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                      >
                        📄 CSV出力
                      </button>
                    )}

                    <div className="bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
                      <div className="text-xs text-blue-700 text-center mb-1">今月の合計</div>
                      <div className="text-xl font-bold text-blue-900 text-center">¥{monthlyTotal.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {viewMode === 'calendar' ? (
                  <div>
                    {/* デスクトップ: カレンダー表示 */}
                    <div className="hidden md:block">
                      <CalendarView
                        calendarDays={calendarDays}
                        getExpensesForDate={getExpensesForDate}
                        getDayTotal={getDayTotal}
                      />
                    </div>
                    {/* モバイル: リスト表示 */}
                    <div className="md:hidden">
                      <MobileListView
                        expenses={expenses}
                        currentMonth={currentMonth}
                        isAdmin={isAdmin}
                        currentUser={currentUser}
                        openEditModal={openEditModal}
                        toggleLock={toggleLock}
                        deleteExpense={deleteExpense}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* デスクトップ: 表形式 */}
                    <div className="hidden md:block">
                      <TableView
                        expenses={expenses}
                        currentMonth={currentMonth}
                        isAdmin={isAdmin}
                        currentUser={currentUser}
                        openEditModal={openEditModal}
                        toggleLock={toggleLock}
                        deleteExpense={deleteExpense}
                      />
                    </div>
                    {/* モバイル: リスト表示 */}
                    <div className="md:hidden">
                      <MobileListView
                        expenses={expenses}
                        currentMonth={currentMonth}
                        isAdmin={isAdmin}
                        currentUser={currentUser}
                        openEditModal={openEditModal}
                        toggleLock={toggleLock}
                        deleteExpense={deleteExpense}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 新規登録リンク */}
            <div className="mt-6 flex justify-center">
              <a
                href="/expense"
                className="text-indigo-600 hover:text-indigo-500 text-sm inline-flex items-center"
              >
                ➕ 新規登録
              </a>
            </div>
          </div>
        </div>
      </>
    </PageAccessGuard>
  );
}

// カレンダービューコンポーネント
function CalendarView({ calendarDays, getExpensesForDate, getDayTotal }: { calendarDays: { date: Date; day?: number; isCurrentMonth: boolean; dateString?: string; isToday?: boolean }[]; getExpensesForDate: (dateString: string) => Expense[]; getDayTotal: (dateString: string) => number }) {
  return (
    <>
      {/* カレンダーヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
          <div key={index} className="p-3 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const dateString = day.dateString || '';
          const dayExpenses = getExpensesForDate(dateString);
          const dayTotal = getDayTotal(dateString);

          return (
            <div
              key={index}
              className={`min-h-[100px] p-2 border border-gray-200 rounded ${!day.isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                } ${day.isToday ? 'bg-blue-50 border-blue-200' : ''}`}
            >
              <div className={`text-sm font-medium mb-2 ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
                } ${day.isToday ? 'text-blue-600' : ''}`}>
                {day.date.getDate()}
              </div>

              {dayExpenses.length > 0 && (
                <div className="space-y-1">
                  {dayExpenses.slice(0, 2).map((expense) => (
                    <div
                      key={expense.id}
                      className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded truncate"
                      title={`${expense.departure} → ${expense.arrival}: ¥${expense.amount.toLocaleString()}`}
                    >
                      ¥{expense.amount.toLocaleString()}
                    </div>
                  ))}
                  {dayExpenses.length > 2 && (
                    <div className="text-xs text-gray-500">
                      +{dayExpenses.length - 2}件
                    </div>
                  )}
                  {dayExpenses.length > 1 && (
                    <div className="text-xs font-bold text-gray-900 border-t pt-1">
                      計: ¥{dayTotal.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// 編集モーダルコンポーネント  
function EditModal({ item, onClose, onUpdate, currentUser }: { item: Expense; onClose: () => void; onUpdate: () => void; currentUser: User | null }) {
  const [formData, setFormData] = useState({
    type: 'TRANSPORT',
    date: '',
    departure: '',
    arrival: '',
    route: '',
    amount: '',
    description: '',
    referenceUrl: '',
    validFrom: '',
    validUntil: '',
    imageUrl: '',
    tripType: 'ONE_WAY'
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // 日付の最小値を計算（期限無視権限がない場合の制限）
  const getMinDate = () => {
    const hasIgnoreDeadlinePermission = currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline;

    if (hasIgnoreDeadlinePermission) {
      return undefined; // 制限なし
    }

    const today = getJapanNow();
    const currentDay = today.getDate();

    if (currentDay <= 3) {
      // 3日以内なら前月も選択可能
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return formatJapanDate(prevMonth);
    } else {
      // 3日を過ぎたら当月のみ
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return formatJapanDate(currentMonth);
    }
  };

  // 日付の最大値を計算（期限無視権限がない場合は今日まで）
  const getMaxDate = () => {
    const hasIgnoreDeadlinePermission = currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline;

    if (hasIgnoreDeadlinePermission) {
      return undefined; // 制限なし
    }

    const today = getJapanNow();
    return formatJapanDate(today); // 今日まで
  };

  useEffect(() => {
    setFormData({
      type: item.type || 'TRANSPORT',
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      departure: item.departure || '',
      arrival: item.arrival || '',
      route: item.route || '',
      amount: item.amount ? item.amount.toString() : '',
      description: item.description || '',
      referenceUrl: item.referenceUrl || '',
      validFrom: item.validFrom ? new Date(item.validFrom).toISOString().split('T')[0] : '',
      validUntil: item.validUntil ? new Date(item.validUntil).toISOString().split('T')[0] : '',
      imageUrl: item.imageUrl || '',
      tripType: item.tripType || 'ONE_WAY',
    });
    setUploadedFile(null);
  }, [item]);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, imageUrl: data.url }));
        setUploadedFile(file);
        showAlert('画像をアップロードしました');
      } else {
        const errorData = await response.json();
        showAlert(`アップロードに失敗しました: ${errorData.error}`);
      }
    } catch (error: unknown) {
      console.error('アップロードエラー:', error);
      showAlert('アップロード中にエラーが発生しました');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = `/api/expenses/${item.id}`;

      // 交通費で往復の場合は金額を2倍にする
      let finalAmount = parseFloat(formData.amount);
      if (formData.type === 'TRANSPORT' && formData.tripType === 'ROUND_TRIP') {
        finalAmount = finalAmount * 2;
      }

      const updateData = {
        ...formData,
        amount: finalAmount,
      };

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        showAlert('更新しました');
        onUpdate();
      } else {
        const errorData = await response.json();
        showAlert(`更新に失敗しました: ${errorData.error}`);
      }
    } catch (error: unknown) {
      console.error('更新エラー:', error);
      showAlert('更新中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {item.type === 'COMMUTE_PASS' ? '定期券編集' :
                item.type === 'TRANSPORT' ? '交通費編集' : '宿泊費編集'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                種別
              </label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  setFormData({
                    type: newType,
                    date: '',
                    departure: '',
                    arrival: '',
                    route: '',
                    amount: '',
                    description: '',
                    referenceUrl: '',
                    validFrom: '',
                    validUntil: '',
                    imageUrl: '',
                    tripType: 'ONE_WAY'
                  });
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="TRANSPORT">交通費</option>
                <option value="LODGING">宿泊費</option>
                <option value="COMMUTE_PASS">定期券</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.type === 'COMMUTE_PASS' ? '購入日' : '日付'} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                min={getMinDate()}
                max={getMaxDate()}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              {(getMinDate() || getMaxDate()) && !currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline && (
                <p className="mt-1 text-xs text-gray-500">
                  💡 {new Date().getDate() > 3 ? '当月' : '前月'}〜今日までの日付を選択してください
                </p>
              )}
            </div>

            {formData.type === 'TRANSPORT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  往復・片道 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="ONE_WAY"
                      checked={formData.tripType === "ONE_WAY"}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tripType: e.target.value }))}
                      className="mr-2"
                    />
                    片道
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="ROUND_TRIP"
                      checked={formData.tripType === "ROUND_TRIP"}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tripType: e.target.value }))}
                      className="mr-2"
                    />
                    往復
                  </label>
                </div>
              </div>
            )}

            {(formData.type === 'TRANSPORT' || formData.type === 'COMMUTE_PASS') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'COMMUTE_PASS' ? '開始駅' : '出発地'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.departure}
                    onChange={(e) => setFormData((prev) => ({ ...prev, departure: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'COMMUTE_PASS' ? '終了駅' : '到着地'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.arrival}
                    onChange={(e) => setFormData((prev) => ({ ...prev, arrival: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
            )}

            {formData.type === 'TRANSPORT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  経路
                </label>
                <input
                  type="text"
                  value={formData.route}
                  onChange={(e) => setFormData((prev) => ({ ...prev, route: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {formData.type === 'LODGING' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  詳細 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            )}

            {formData.type === 'COMMUTE_PASS' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validFrom: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validUntil: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金額 (円) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min="0"
                step="1"
                required
              />
              {formData.type === 'TRANSPORT' && formData.tripType === 'ROUND_TRIP' && formData.amount && (
                <p className="mt-1 text-sm text-blue-600">
                  💡 往復のため、登録時は金額が2倍（¥{(parseFloat(formData.amount) * 2).toLocaleString()}）になります
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                参照URL
              </label>
              <input
                type="url"
                value={formData.referenceUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, referenceUrl: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                領収書・購入証明画像
              </label>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {uploading && (
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                    アップロード中...
                  </div>
                )}
                {uploadedFile && (
                  <div className="flex items-center text-sm text-green-600">
                    <span className="mr-2">✓</span>
                    {uploadedFile.name} がアップロードされました
                  </div>
                )}
                {formData.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={formData.imageUrl}
                      alt="購入証明"
                      className="max-w-xs h-32 object-cover border border-gray-300 rounded-md"
                    />
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  JPEG、PNG、GIF、WebP形式、5MB以下のファイルをアップロードしてください
                </p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {loading ? '更新中...' : '更新する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// モバイル専用リストビューコンポーネント
function MobileListView({ expenses, currentMonth, isAdmin, currentUser, openEditModal, toggleLock, deleteExpense }: { expenses: Expense[]; currentMonth: Date; isAdmin: boolean; currentUser: User | null; openEditModal: (item: Expense) => void; toggleLock: (item: Expense, action: 'lock' | 'unlock') => void; deleteExpense: (item: Expense & { departure?: string; arrival?: string }) => void }) {
  // 日付順にソート
  const sortedExpenses = expenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 期限制限チェック（クライアントサイド）
  const canEditByDate = (expenseDate: Date) => {
    const today = new Date();
    const targetYear = expenseDate.getFullYear();
    const targetMonth = expenseDate.getMonth();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();

    // 権限がある場合は期限無視
    const hasIgnoreDeadlinePermission = currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline;
    if (hasIgnoreDeadlinePermission) {
      return true;
    }

    // 当月と未来月は常に編集可能
    if (targetYear > todayYear || (targetYear === todayYear && targetMonth >= todayMonth)) {
      return true;
    }

    // 過去月の場合、翌月3日までかチェック
    const nextMonth = new Date(targetYear, targetMonth + 1, 3);
    nextMonth.setHours(23, 59, 59, 999);

    return today <= nextMonth;
  };

  if (sortedExpenses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg">
          {currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}の登録はありません
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedExpenses.map((item) => {
        const itemDate = new Date(item.date);
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][itemDate.getDay()];

        return (
          <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            {/* 日付・種別・金額のヘッダー */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-base font-semibold text-gray-900">
                  {itemDate.getMonth() + 1}/{itemDate.getDate()}
                  <span className={`ml-2 text-sm font-normal ${dayOfWeek === '日' || dayOfWeek === '土' ? 'text-red-500' : 'text-gray-500'}`}>
                    ({dayOfWeek})
                  </span>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${item.type === 'TRANSPORT' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  item.type === 'LODGING' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                    'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                  {item.type === 'TRANSPORT' ? '交通費' :
                    item.type === 'LODGING' ? '宿泊費' : '定期券'}
                </span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                ¥{item.amount.toLocaleString()}
              </div>
            </div>

            {/* 経路・説明 */}
            <div className="mb-4">
              {item.type === 'COMMUTE_PASS' || item.type === 'TRANSPORT' ? (
                <div>
                  <div className="text-gray-900 font-medium text-base leading-relaxed">
                    {item.departure} → {item.arrival}
                  </div>
                  {item.route && (
                    <div className="text-sm text-gray-600 mt-2 leading-relaxed">
                      経路: {item.route}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-900 font-medium text-base leading-relaxed">{item.description}</div>
              )}
            </div>

            {/* 管理者情報（コンパクト表示） */}
            {isAdmin && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-800">{item.user?.name || '-'}</div>
                <div className="text-xs text-gray-500 mt-1">{item.user?.userId || item.user?.id || '-'}</div>
              </div>
            )}

            {/* 定期券の有効期間 */}
            {item.type === 'COMMUTE_PASS' && (item.validFrom || item.validUntil) && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">有効期間:</span> {item.validFrom && item.validUntil
                    ? `${new Date(item.validFrom).toLocaleDateString('ja-JP')}〜${new Date(item.validUntil).toLocaleDateString('ja-JP')}`
                    : item.validUntil
                      ? `〜${new Date(item.validUntil).toLocaleDateString('ja-JP')}`
                      : item.validFrom
                        ? `${new Date(item.validFrom).toLocaleDateString('ja-JP')}〜`
                        : '-'
                  }
                </div>
              </div>
            )}

            {/* 参照リンク */}
            <div className="mb-4 flex items-center space-x-4">
              {item.referenceUrl && (
                <a
                  href={item.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 text-sm hover:text-blue-800"
                >
                  <span className="mr-1">🔗</span>
                  参照URL
                </a>
              )}
              {item.imageUrl && (
                <a
                  href={item.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 text-sm hover:text-blue-800"
                >
                  <span className="mr-1">📷</span>
                  画像
                </a>
              )}
            </div>

            {/* ステータス表示 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {!canEditByDate(new Date(item.date)) && !currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                  <span className="mr-1">⏰</span>編集期限切れ
                </span>
              )}

              {currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline && (() => {
                const today = new Date();
                const expenseDate = new Date(item.date);
                const targetYear = expenseDate.getFullYear();
                const targetMonth = expenseDate.getMonth();
                const todayYear = today.getFullYear();
                const todayMonth = today.getMonth();

                if (targetYear >= todayYear && (targetYear > todayYear || targetMonth >= todayMonth)) {
                  return false;
                }

                const nextMonth = new Date(targetYear, targetMonth + 1, 3);
                nextMonth.setHours(23, 59, 59, 999);
                return today > nextMonth;
              })() && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                    <span className="mr-1">👑</span>管理者権限
                  </span>
                )}

              {item.isLocked && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                  <span className="mr-1">🔒</span>ロック済み
                </span>
              )}
            </div>

            {/* 操作ボタン（改良版） */}
            <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
              {/* 編集ボタン */}
              {(isAdmin || item.userId === currentUser?.id) && !item.isLocked && canEditByDate(new Date(item.date)) && (
                <button
                  onClick={() => openEditModal(item)}
                  className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <span className="mr-2">✏️</span>編集
                </button>
              )}

              {/* 削除ボタン */}
              {(isAdmin || item.userId === currentUser?.id) && !item.isLocked && canEditByDate(new Date(item.date)) && (
                <button
                  onClick={() => deleteExpense(item)}
                  className="flex items-center px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  <span className="mr-2">🗑️</span>削除
                </button>
              )}

              {/* ロック/アンロックボタン（管理者のみ） */}
              {isAdmin && (
                <button
                  onClick={() => toggleLock(item, item.isLocked ? 'unlock' : 'lock')}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${item.isLocked
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                    }`}
                >
                  <span className="mr-2">{item.isLocked ? '🔒' : '🔓'}</span>
                  {item.isLocked ? 'アンロック' : 'ロック'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 表形式ビューコンポーネント
function TableView({ expenses, currentMonth, isAdmin, currentUser, openEditModal, toggleLock, deleteExpense }: { expenses: Expense[]; currentMonth: Date; isAdmin: boolean; currentUser: User | null; openEditModal: (item: Expense) => void; toggleLock: (item: Expense, action: 'lock' | 'unlock') => void; deleteExpense: (item: Expense & { departure?: string; arrival?: string }) => void }) {
  // 日付順にソート
  const sortedExpenses = expenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 期限制限チェック（クライアントサイド）
  const canEditByDate = (expenseDate: Date) => {
    const today = new Date();
    const targetYear = expenseDate.getFullYear();
    const targetMonth = expenseDate.getMonth();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();

    // 権限がある場合は期限無視
    const hasIgnoreDeadlinePermission = currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline;
    if (hasIgnoreDeadlinePermission) {
      return true;
    }

    // 当月と未来月は常に編集可能
    if (targetYear > todayYear || (targetYear === todayYear && targetMonth >= todayMonth)) {
      return true;
    }

    // 過去月の場合、翌月3日までかチェック
    const nextMonth = new Date(targetYear, targetMonth + 1, 3);
    nextMonth.setHours(23, 59, 59, 999);

    return today <= nextMonth;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              日付
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              曜日
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              種別
            </th>
            {isAdmin && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ユーザー
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              経路
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              詳細路線
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              金額
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              参照
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedExpenses.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                {currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}の登録はありません
              </td>
            </tr>
          ) : (
            sortedExpenses.map((item) => {
              const itemDate = new Date(item.date);
              const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][itemDate.getDay()];

              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.type === 'COMMUTE_PASS' && (item.validFrom || item.validUntil) ? (
                      <div>
                        <div>{itemDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}</div>
                        <div className="text-xs text-gray-500">
                          {item.validFrom && item.validUntil
                            ? `${new Date(item.validFrom).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜${new Date(item.validUntil).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                            : item.validUntil
                              ? `〜${new Date(item.validUntil).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}`
                              : item.validFrom
                                ? `${new Date(item.validFrom).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}〜`
                                : '-'
                          }
                        </div>
                      </div>
                    ) : (
                      itemDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`${dayOfWeek === '日' || dayOfWeek === '土' ? 'text-red-600' : ''}`}>
                      {dayOfWeek}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'TRANSPORT' ? 'bg-blue-100 text-blue-800' :
                      item.type === 'LODGING' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                      {item.type === 'TRANSPORT' ? '交通費' :
                        item.type === 'LODGING' ? '宿泊費' : '定期券'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{item.user?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{item.user?.userId || item.user?.id || '-'}</div>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.type === 'COMMUTE_PASS' || item.type === 'TRANSPORT' ? (
                      <div>
                        <div className="font-medium">
                          {item.departure} → {item.arrival}
                        </div>
                      </div>
                    ) : (
                      <div className="font-medium">{item.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    {item.route && (
                      <div className="truncate" title={item.route}>
                        {item.route}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    ¥{item.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-3">
                      {item.referenceUrl && (
                        <a
                          href={item.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900"
                          title="参照URL"
                        >
                          🔗
                        </a>
                      )}
                      {item.imageUrl && (
                        <a
                          href={item.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900"
                          title="証明画像"
                        >
                          📷
                        </a>
                      )}
                      {!item.referenceUrl && !item.imageUrl && (
                        <span className="text-gray-300">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex space-x-2">
                      {/* 編集ボタン */}
                      {(isAdmin || item.userId === currentUser?.id) && !item.isLocked && canEditByDate(new Date(item.date)) && (
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-blue-600 hover:text-blue-900 text-xs"
                          title="編集"
                        >
                          ✏️
                        </button>
                      )}

                      {/* 削除ボタン */}
                      {(isAdmin || item.userId === currentUser?.id) && !item.isLocked && canEditByDate(new Date(item.date)) && (
                        <button
                          onClick={() => deleteExpense(item)}
                          className="text-red-600 hover:text-red-900 text-xs"
                          title="削除"
                        >
                          🗑️
                        </button>
                      )}

                      {/* ロック/アンロックボタン（管理者のみ） */}
                      {isAdmin && (
                        <button
                          onClick={() => toggleLock(item, item.isLocked ? 'unlock' : 'lock')}
                          className={`text-xs ${item.isLocked ? 'text-red-600 hover:text-red-900' : 'text-yellow-600 hover:text-yellow-900'}`}
                          title={item.isLocked ? 'アンロック' : 'ロック'}
                        >
                          {item.isLocked ? '🔒' : '🔓'}
                        </button>
                      )}

                      {/* 期限切れ表示 */}
                      {!canEditByDate(new Date(item.date)) && !currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline && (
                        <span className="text-gray-400 text-xs" title="編集期限切れ（翌月3日まで）">
                          ⏰
                        </span>
                      )}

                      {/* 管理者権限表示 */}
                      {currentUser?.customRole?.permissions?.expenseManagement?.ignoreDeadline && (() => {
                        const today = new Date();
                        const expenseDate = new Date(item.date);
                        const targetYear = expenseDate.getFullYear();
                        const targetMonth = expenseDate.getMonth();
                        const todayYear = today.getFullYear();
                        const todayMonth = today.getMonth();

                        // 過去月で3日を過ぎている場合のみ表示
                        if (targetYear >= todayYear && (targetYear > todayYear || targetMonth >= todayMonth)) {
                          return false; // 当月・未来月は表示しない
                        }

                        const nextMonth = new Date(targetYear, targetMonth + 1, 3);
                        nextMonth.setHours(23, 59, 59, 999);
                        return today > nextMonth; // 3日を過ぎている場合のみ表示
                      })() && (
                          <span className="text-green-600 text-xs" title="管理者権限により期限無視">
                            👑
                          </span>
                        )}

                      {/* ロック状態表示 */}
                      {item.isLocked && (
                        <span className="text-red-500 text-xs" title={`${item.locker?.name}によりロック済み`}>
                          🔒
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}