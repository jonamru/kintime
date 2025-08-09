"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import PageAccessGuard from "@/components/PageAccessGuard";
import { showAlert } from '@/lib/notification';
import { formatJapanDate, formatJapanDateTime } from '@/lib/dateUtils';

interface User {
  id: string;
  name: string;
  userId: string;
  email: string;
  partner?: {
    name: string;
  };
}

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  wakeUp?: string;
  departure?: string;
  clockInId?: string;
  clockOutId?: string;
  wakeUpId?: string;
  departureId?: string;
  user: User;
  shift?: {
    startTime: string;
    endTime: string;
    breakTime: number;
  };
}

interface ShiftRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  location: string;
  breakTime: number;
  status: string;
  user: User;
  hasAttendance?: boolean; // 打刻済みフラグ
}

interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  receiptPath?: string;
  status: string;
  user: User;
}

type RecordType = 'attendance' | 'shift' | 'expense';

interface BulkEditData {
  attendance: AttendanceRecord[];
  shift: ShiftRecord[];
  expense: ExpenseRecord[];
}

export default function BulkEditPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState<RecordType>('attendance');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BulkEditData>({
    attendance: [],
    shift: [],
    expense: []
  });
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editingCells, setEditingCells] = useState<Set<string>>(new Set());
  const [tempValues, setTempValues] = useState<{[key: string]: any}>({});
  const [userSearchTerm, setUserSearchTerm] = useState<string>("");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser && selectedMonth) {
      fetchData();
    }
  }, [selectedUser, selectedMonth, activeTab]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const result = await response.json();
        setUsers(result.users || []);
      }
    } catch (error) {
      console.error("ユーザー取得エラー:", error);
    }
  };

  const fetchData = async () => {
    if (!selectedUser || !selectedMonth) return;
    
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      let url = '';
      
      switch (activeTab) {
        case 'attendance':
          url = `/api/attendance/monthly-summary?userId=${selectedUser}&year=${year}&month=${month}&bulk=true`;
          break;
        case 'shift':
          url = `/api/shift/admin-shifts?year=${year}&month=${month}&userId=${selectedUser}&bulk=true`;
          break;
        case 'expense':
          url = `/api/expenses/monthly?userId=${selectedUser}&year=${year}&month=${month}`;
          break;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        
        let filteredData = result;
        if (activeTab === 'shift' && Array.isArray(result)) {
          filteredData = result.filter((record: any) => record.userId === selectedUser);
        }

        console.log('取得データ詳細:', {
          activeTab,
          dataLength: Array.isArray(filteredData) ? filteredData.length : 0,
          firstRecord: Array.isArray(filteredData) && filteredData.length > 0 ? filteredData[0] : null
        });
        
        setData(prev => ({
          ...prev,
          [activeTab]: Array.isArray(filteredData) ? filteredData : []
        }));
      }
    } catch (error) {
      console.error(`${activeTab}データ取得エラー:`, error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecordSelection = (recordId: string, record?: any) => {
    // シフトで打刻済みの場合は選択不可
    if (activeTab === 'shift' && record?.hasAttendance) {
      return;
    }
    
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const selectAllRecords = () => {
    const currentData = data[activeTab];
    // 選択可能なレコードのみフィルタ（シフトの場合は打刻済みを除外）
    const selectableRecords = currentData.filter((record: any) => 
      !(activeTab === 'shift' && record.hasAttendance)
    );
    
    if (selectedRecords.size === selectableRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(selectableRecords.map((record: any) => record.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.size === 0) {
      showAlert("削除する項目を選択してください");
      return;
    }

    // 仮想レコード（empty-で始まるID）を除外
    const realRecords = Array.from(selectedRecords).filter(id => !id.startsWith('empty-'));
    const virtualRecords = Array.from(selectedRecords).filter(id => id.startsWith('empty-'));

    if (realRecords.length === 0) {
      showAlert("削除可能な項目がありません");
      return;
    }

    if (virtualRecords.length > 0) {
      showAlert(`${virtualRecords.length}件の仮想項目をスキップし、${realRecords.length}件を削除します`);
    }

    if (!confirm(`選択した${realRecords.length}件のデータを削除しますか？`)) {
      return;
    }

    setLoading(true);
    try {
      const deletePromises = realRecords.map(recordId => {
        let url = '';
        switch (activeTab) {
          case 'attendance':
            url = `/api/attendance/delete`;
            break;
          case 'shift':
            url = `/api/shift/shifts/${recordId}`;
            break;
          case 'expense':
            url = `/api/expenses/${recordId}`;
            break;
        }

        return fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: activeTab === 'attendance' ? JSON.stringify({ id: recordId }) : undefined,
        });
      });

      const results = await Promise.all(deletePromises);
      const failedDeletes = results.filter(r => !r.ok);

      if (failedDeletes.length === 0) {
        showAlert(`${realRecords.length}件のデータを削除しました`);
        setSelectedRecords(new Set());
        fetchData();
      } else {
        // 失敗したレスポンスの詳細を取得
        const errorDetails = await Promise.all(
          failedDeletes.map(async (response) => {
            try {
              const errorData = await response.json();
              return errorData.error || response.statusText;
            } catch {
              return response.statusText;
            }
          })
        );
        console.error('削除エラー詳細:', errorDetails);
        showAlert(`${failedDeletes.length}件の削除に失敗しました: ${errorDetails[0]}`);
      }
    } catch (error) {
      showAlert("削除処理でエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const renderAttendanceTable = () => {
    const records = data.attendance as AttendanceRecord[];
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRecords.size === records.length && records.length > 0}
                  onChange={selectAllRecords}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">起床時刻</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">出発時刻</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">出勤時刻</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">退勤時刻</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedRecords.has(record.id)}
                    onChange={() => toggleRecordSelection(record.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="p-1 min-h-[24px] flex items-center">
                    {formatDateDisplay(record.date)}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="wakeUp" 
                    value={record.wakeUp}
                    type="time"
                    placeholder="起床時刻"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="departure" 
                    value={record.departure}
                    type="time"
                    placeholder="出発時刻"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="clockIn" 
                    value={record.clockIn}
                    type="time"
                    placeholder="出勤時刻"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="clockOut" 
                    value={record.clockOut}
                    type="time"
                    placeholder="退勤時刻"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => handleDeleteRecord(record.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderShiftTable = () => {
    const records = data.shift as ShiftRecord[];
    // 選択可能なレコード数を計算
    const selectableRecords = records.filter(record => !record.hasAttendance);
    const selectableCount = selectableRecords.length;
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRecords.size === selectableCount && selectableCount > 0}
                  onChange={selectAllRecords}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">勤務地</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイプ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.map((record) => {
              const isAttended = record.hasAttendance;
              const isSelectable = !isAttended;
              
              return (
                <tr key={record.id} className={`${
                  isAttended 
                    ? 'bg-gray-100 text-gray-500' 
                    : 'hover:bg-gray-50'
                }`}>
                <td className="px-4 py-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedRecords.has(record.id)}
                      onChange={() => toggleRecordSelection(record.id, record)}
                      disabled={!isSelectable}
                      className={`rounded ${!isSelectable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {isAttended && (
                      <span className="ml-2 text-xs text-gray-400">打刻済み</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="p-1 min-h-[24px] flex items-center">
                    {formatDateDisplay(record.date)}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex space-x-1 items-center">
                    <EditableCell 
                      record={record} 
                      field="startTime" 
                      value={record.startTime}
                      type="time"
                      placeholder="開始時刻"
                    />
                    <span>-</span>
                    <EditableCell 
                      record={record} 
                      field="endTime" 
                      value={record.endTime}
                      type="time"
                      placeholder="終了時刻"
                    />
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="location" 
                    value={record.location}
                    type="text"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="shiftType" 
                    value={record.shiftType}
                    type="select"
                    options={[
                      { value: 'REGULAR', label: '通常' },
                      { value: 'SPOT', label: 'スポット' }
                    ]}
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  {!isAttended && (
                    <button 
                      onClick={() => handleDeleteRecord(record.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      削除
                    </button>
                  )}
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderExpenseTable = () => {
    const records = data.expense as ExpenseRecord[];
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRecords.size === records.length && records.length > 0}
                  onChange={selectAllRecords}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">内容</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedRecords.has(record.id)}
                    onChange={() => toggleRecordSelection(record.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="date" 
                    value={formatJapanDate(new Date(record.date))}
                    type="date"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="category" 
                    value={record.category}
                    type="select"
                    options={[
                      { value: '交通費', label: '交通費' },
                      { value: '食事代', label: '食事代' },
                      { value: '宿泊費', label: '宿泊費' },
                      { value: 'その他', label: 'その他' }
                    ]}
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="amount" 
                    value={record.amount}
                    type="number"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  <EditableCell 
                    record={record} 
                    field="description" 
                    value={record.description}
                    type="text"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    record.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                    record.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {record.status === 'APPROVED' ? '承認済み' : 
                     record.status === 'PENDING' ? '承認待ち' : '却下'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => handleDeleteRecord(record.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleBulkApprove = async () => {
    if (selectedRecords.size === 0) {
      showAlert("承認する項目を選択してください");
      return;
    }

    if (!confirm(`選択した${selectedRecords.size}件を承認しますか？`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          type: activeTab,
          records: Array.from(selectedRecords)
        }),
      });

      const result = await response.json();
      if (response.ok) {
        showAlert(result.message);
        setSelectedRecords(new Set());
        fetchData();
      } else {
        showAlert(result.error || "承認処理に失敗しました");
      }
    } catch (error) {
      showAlert("承認処理でエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setShowEditModal(true);
  };

  const handleDeleteRecord = async (recordId: string) => {
    // 仮想レコードの場合は削除不可
    if (recordId.startsWith('empty-')) {
      showAlert("この項目は削除できません（仮想レコード）");
      return;
    }

    if (!confirm("この項目を削除しますか？")) return;
    
    setLoading(true);
    try {
      let url = '';
      switch (activeTab) {
        case 'attendance':
          url = '/api/attendance/delete';
          break;
        case 'shift':
          url = `/api/shift/shifts/${recordId}`;
          break;
        case 'expense':
          url = `/api/expenses/${recordId}`;
          break;
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: activeTab === 'attendance' ? JSON.stringify({ id: recordId }) : undefined,
      });

      if (response.ok) {
        showAlert("データを削除しました");
        fetchData();
      } else {
        try {
          const errorData = await response.json();
          console.error('個別削除エラー:', errorData);
          showAlert(`削除に失敗しました: ${errorData.error || response.statusText}`);
        } catch {
          showAlert(`削除に失敗しました: ${response.statusText}`);
        }
      }
    } catch (error) {
      showAlert("削除処理でエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // インライン編集関数
  const startEdit = (recordId: string, field: string, currentValue: any) => {
    const cellKey = `${recordId}-${field}`;
    setEditingCells(prev => new Set([...prev, cellKey]));
    setTempValues(prev => ({ ...prev, [cellKey]: currentValue }));
  };

  const cancelEdit = (recordId: string, field: string) => {
    const cellKey = `${recordId}-${field}`;
    setEditingCells(prev => {
      const newSet = new Set(prev);
      newSet.delete(cellKey);
      return newSet;
    });
    setTempValues(prev => {
      const newValues = { ...prev };
      delete newValues[cellKey];
      return newValues;
    });
  };

  const saveEdit = async (recordId: string, field: string) => {
    const cellKey = `${recordId}-${field}`;
    const newValue = tempValues[cellKey];
    
    console.log('保存開始:', { recordId, field, newValue, activeTab });
    
    setLoading(true);
    try {
      // 専用のインライン編集APIを使用
      const response = await fetch('/api/admin/inline-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          recordId,
          field,
          value: newValue
        }),
      });

      const responseData = await response.json();
      console.log('API応答:', { status: response.status, data: responseData });

      if (response.ok) {
        // ローカル状態を更新
        setData(prev => ({
          ...prev,
          [activeTab]: prev[activeTab].map((record: any) =>
            record.id === recordId ? { ...record, [field]: newValue } : record
          )
        }));
        
        // 編集状態を解除
        cancelEdit(recordId, field);
        showAlert("更新しました");
      } else {
        showAlert(`更新に失敗しました: ${responseData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('更新エラー:', error);
      showAlert(`更新処理でエラーが発生しました: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCellValueChange = (recordId: string, field: string, value: any) => {
    const cellKey = `${recordId}-${field}`;
    setTempValues(prev => ({ ...prev, [cellKey]: value }));
  };

  const isEditing = (recordId: string, field: string) => {
    return editingCells.has(`${recordId}-${field}`);
  };

  const getCellValue = (recordId: string, field: string, originalValue: any) => {
    const cellKey = `${recordId}-${field}`;
    return tempValues.hasOwnProperty(cellKey) ? tempValues[cellKey] : originalValue;
  };

  // 時間フォーマット用のヘルパー関数
  const formatTimeDisplay = (timeValue: any) => {
    console.log('formatTimeDisplay - 受信値:', timeValue, '型:', typeof timeValue);
    
    if (!timeValue) return '';
    
    try {
      // 既にHH:MM形式の文字列の場合はそのまま返す
      if (typeof timeValue === 'string' && /^\d{2}:\d{2}$/.test(timeValue)) {
        console.log('既にHH:MM形式:', timeValue);
        return timeValue;
      }
      
      const date = new Date(timeValue);
      console.log('Date変換結果:', date, 'isNaN:', isNaN(date.getTime()));
      
      if (isNaN(date.getTime())) return '';
      
      const formatted = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      console.log('フォーマット結果:', formatted);
      return formatted;
    } catch (error) {
      console.log('formatTimeDisplay エラー:', error);
      return '';
    }
  };

  // 日付フォーマット用のヘルパー関数
  const formatDateDisplay = (dateValue: any) => {
    console.log('formatDateDisplay - 受信値:', dateValue, '型:', typeof dateValue);
    
    if (!dateValue) return '';
    
    try {
      // 既にYYYY-MM-DD形式の文字列の場合はそのまま返す
      if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        console.log('既にYYYY-MM-DD形式:', dateValue);
        return dateValue;
      }
      
      const date = new Date(dateValue);
      console.log('Date変換結果:', date, 'isNaN:', isNaN(date.getTime()));
      
      if (isNaN(date.getTime())) return '';
      
      const formatted = formatJapanDate(date);
      console.log('フォーマット結果:', formatted);
      return formatted;
    } catch (error) {
      console.log('formatDateDisplay エラー:', error);
      return '';
    }
  };

  // 時間入力値を正規化する関数
  const normalizeTimeInput = (value: string) => {
    // 数字のみを抽出
    const digits = value.replace(/[^0-9]/g, '');
    
    if (digits.length === 0) return '';
    if (digits.length === 1) return digits + ':';
    if (digits.length === 2) return digits + ':';
    if (digits.length === 3) return digits.slice(0, 1) + ':' + digits.slice(1);
    if (digits.length >= 4) {
      const hours = digits.slice(0, 2);
      const minutes = digits.slice(2, 4);
      // 時間の範囲チェック
      const h = parseInt(hours);
      const m = parseInt(minutes);
      if (h > 23) return '23:' + (m > 59 ? '59' : minutes.padStart(2, '0'));
      if (m > 59) return hours.padStart(2, '0') + ':59';
      return hours.padStart(2, '0') + ':' + minutes.padStart(2, '0');
    }
    return value;
  };

  // 編集可能セルコンポーネント
  const EditableCell = ({ 
    record, 
    field, 
    value, 
    type = 'text',
    options = [],
    placeholder = ''
  }: { 
    record: any; 
    field: string; 
    value: any; 
    type?: 'text' | 'time' | 'number' | 'select' | 'date';
    options?: Array<{value: string, label: string}>;
    placeholder?: string;
  }) => {
    const editing = isEditing(record.id, field);
    const cellValue = getCellValue(record.id, field, value);

    // フィールドタイプに応じた表示値の処理
    let displayValue;
    if (type === 'time') {
      const timeDisplayed = formatTimeDisplay(value);
      displayValue = timeDisplayed || (placeholder ? placeholder : '-');
    } else if (type === 'date') {
      displayValue = formatDateDisplay(value) || '-';
    } else if (type === 'select' && options.length > 0) {
      displayValue = options.find(opt => opt.value === value)?.label || value || '-';
    } else {
      displayValue = value || (placeholder ? placeholder : '-');
    }

    if (!editing) {
      const isEmptyTime = type === 'time' && !formatTimeDisplay(value);
      return (
        <div 
          onClick={() => startEdit(record.id, field, 
            type === 'time' ? formatTimeDisplay(value) : 
            type === 'date' ? formatDateDisplay(value) : 
            value
          )}
          className={`cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[24px] flex items-center ${
            isEmptyTime ? 'text-gray-400 italic' : ''
          }`}
          title="クリックして編集"
        >
          {displayValue}
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1">
        {type === 'select' ? (
          <select
            value={cellValue}
            onChange={(e) => handleCellValueChange(record.id, field, e.target.value)}
            className="text-xs border rounded px-1 py-0.5 w-full"
            autoFocus
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : type === 'time' ? (
          <input
            type="text"
            value={cellValue}
            onChange={(e) => {
              const normalized = normalizeTimeInput(e.target.value);
              handleCellValueChange(record.id, field, normalized);
            }}
            className="text-xs border rounded px-1 py-0.5 w-full"
            autoFocus
            placeholder="HH:MM"
            maxLength={5}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveEdit(record.id, field);
              } else if (e.key === 'Escape') {
                cancelEdit(record.id, field);
              }
            }}
          />
        ) : (
          <input
            type={type}
            value={cellValue}
            onChange={(e) => handleCellValueChange(record.id, field, 
              type === 'number' ? Number(e.target.value) : e.target.value
            )}
            className="text-xs border rounded px-1 py-0.5 w-full"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveEdit(record.id, field);
              } else if (e.key === 'Escape') {
                cancelEdit(record.id, field);
              }
            }}
          />
        )}
        <button
          onClick={() => saveEdit(record.id, field)}
          className="text-green-600 hover:text-green-800 text-xs p-0.5"
          title="保存"
        >
          ✓
        </button>
        <button
          onClick={() => cancelEdit(record.id, field)}
          className="text-red-600 hover:text-red-800 text-xs p-0.5"
          title="キャンセル"
        >
          ×
        </button>
      </div>
    );
  };

  const selectedUserName = users.find(u => u.id === selectedUser)?.name || '';

  // ユーザー検索フィルタリング
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.userId.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (user.partner?.name || '').toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  if (!currentUser) return null;

  return (
    <PageAccessGuard page="bulkEdit">
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
      <div className="min-h-screen bg-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">一括修正管理</h1>
              </div>

              {/* フィルターエリア */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      対象ユーザー
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="ユーザー名、ID、メール、企業名で検索..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        size={Math.min(filteredUsers.length + 1, 8)}
                      >
                        <option value="">ユーザーを選択してください</option>
                        {filteredUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.userId}) {user.partner?.name ? `- ${user.partner.name}` : ''}
                          </option>
                        ))}
                      </select>
                      {userSearchTerm && (
                        <div className="text-sm text-gray-500">
                          {filteredUsers.length}件のユーザーが見つかりました
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      対象月
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    {loading && (
                      <div className="mt-2 flex items-center text-sm text-blue-600">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        データを読み込み中...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedUser && selectedUserName && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    {selectedUserName}さんの{selectedMonth}月データ
                  </h2>

                  {/* タブナビゲーション */}
                  <div className="border-b border-gray-200 mb-4">
                    <nav className="-mb-px flex space-x-8">
                      {[
                        { id: 'attendance', name: '勤怠管理', icon: '🕐' },
                        { id: 'shift', name: 'シフト管理', icon: '📅' },
                        { id: 'expense', name: '経費管理', icon: '💰' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as RecordType)}
                          className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === tab.id
                              ? 'border-indigo-500 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="mr-2">{tab.icon}</span>
                          {tab.name}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* 一括操作ボタン */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      {data[activeTab].length}件中 {selectedRecords.size}件選択
                    </div>
                    <div className="space-x-2">
                      <button
                        onClick={selectAllRecords}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        {selectedRecords.size === data[activeTab].length ? '全選択解除' : '全選択'}
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        disabled={selectedRecords.size === 0}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                      >
                        選択項目を削除
                      </button>
                      {(activeTab === 'shift' || activeTab === 'expense') && (
                        <button
                          onClick={handleBulkApprove}
                          disabled={selectedRecords.size === 0}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                        >
                          選択項目を承認
                        </button>
                      )}
                    </div>
                  </div>

                  {/* データテーブル */}
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500">読み込み中...</div>
                    </div>
                  ) : data[activeTab].length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500">データがありません</div>
                    </div>
                  ) : (
                    <>
                      {activeTab === 'attendance' && renderAttendanceTable()}
                      {activeTab === 'shift' && renderShiftTable()}
                      {activeTab === 'expense' && renderExpenseTable()}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageAccessGuard>
  );
}