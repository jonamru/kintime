"use client";

import { useState, useEffect } from "react";
import TimeBaseHeader from '@/components/TimeBaseHeader';
import PageAccessGuard from "@/components/PageAccessGuard";
import { showAlert, showConfirm } from '@/lib/notification';
export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  // 検索・フィルタ用のstate
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [partnersPerPage] = useState(8);
  const [formData, setFormData] = useState({
    name: "",
    userIdPrefix: "",
    address: "",
    phoneNumber: "",
    email: "",
    contactPerson: "",
    contractStartDate: "",
    contractEndDate: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  // フィルタリングロジック
  useEffect(() => {
    let filtered = partners;

    // 検索フィルタ（企業名、住所、担当者、連絡先）
    if (searchTerm) {
      filtered = filtered.filter(partner => 
        partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (partner.address && partner.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (partner.contactPerson && partner.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (partner.phoneNumber && partner.phoneNumber.includes(searchTerm)) ||
        (partner.email && partner.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // ステータスフィルタ
    if (statusFilter) {
      if (statusFilter === 'active') {
        filtered = filtered.filter(partner => partner.isActive);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(partner => !partner.isActive);
      }
    }

    setFilteredPartners(filtered);
    setCurrentPage(1); // フィルタ変更時は1ページ目に戻る
  }, [partners, searchTerm, statusFilter]);

  // ページネーション計算
  const totalPages = Math.ceil(filteredPartners.length / partnersPerPage);
  const startIndex = (currentPage - 1) * partnersPerPage;
  const endIndex = startIndex + partnersPerPage;
  const currentPartners = filteredPartners.slice(startIndex, endIndex);

  // フィルタクリア関数
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const fetchPartners = async () => {
    try {
      const response = await fetch("/api/admin/partners/all");
      if (response.ok) {
        const data = await response.json();
        setPartners(data);
      }
    } catch (error) {
      console.error("パートナー取得エラー:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      userIdPrefix: "",
      address: "",
      phoneNumber: "",
      email: "",
      contactPerson: "",
      contractStartDate: "",
      contractEndDate: "",
      notes: "",
      isActive: true,
    });
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const requestData = {
        ...formData,
        contractStartDate: formData.contractStartDate ? new Date(formData.contractStartDate).toISOString() : null,
        contractEndDate: formData.contractEndDate ? new Date(formData.contractEndDate).toISOString() : null,
      };
      console.log('Creating partner with data:', requestData);
      
      const response = await fetch("/api/admin/partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
      
      const responseData = await response.json();
      console.log('Create response:', response.status, responseData);
      
      if (response.ok) {
        showAlert("パートナー企業を作成しました");
        fetchPartners();
        setShowCreateModal(false);
        resetForm();
      } else {
        console.error('Create error:', responseData);
        showAlert(responseData.error || "パートナー企業の作成に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleEditPartner = (partner: any) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name || "",
      userIdPrefix: partner.userIdPrefix || "",
      address: partner.address || "",
      phoneNumber: partner.phoneNumber || "",
      email: partner.email || "",
      contactPerson: partner.contactPerson || "",
      contractStartDate: partner.contractStartDate ? new Date(partner.contractStartDate).toISOString().split('T')[0] : "",
      contractEndDate: partner.contractEndDate ? new Date(partner.contractEndDate).toISOString().split('T')[0] : "",
      notes: partner.notes || "",
      isActive: partner.isActive ?? true,
    });
    setShowEditModal(true);
  };

  const handleUpdatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner) return;
    
    setLoading(true);
    
    try {
      const requestData = {
        ...formData,
        contractStartDate: formData.contractStartDate ? new Date(formData.contractStartDate).toISOString() : null,
        contractEndDate: formData.contractEndDate ? new Date(formData.contractEndDate).toISOString() : null,
      };
      console.log('Updating partner with data:', requestData);
      
      const response = await fetch(`/api/admin/partners/${selectedPartner.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
      
      const responseData = await response.json();
      console.log('Update response:', response.status, responseData);
      
      if (response.ok) {
        showAlert("パートナー企業情報を更新しました");
        fetchPartners();
        setShowEditModal(false);
        setSelectedPartner(null);
        resetForm();
      } else {
        console.error('Update error:', responseData);
        showAlert(responseData.error || "パートナー企業情報の更新に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePartner = async (partnerId: string) => {
    if (!(await showConfirm("このパートナー企業を削除しますか？\n関連するユーザーがいる場合は削除できません。"))) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "DELETE",
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        showAlert("パートナー企業を削除しました");
        fetchPartners();
      } else {
        showAlert(responseData.error || "パートナー企業の削除に失敗しました");
      }
    } catch (error) {
      showAlert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageAccessGuard page="adminPartners">
      <TimeBaseHeader />
      <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">パートナー企業管理</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                新規パートナー登録
              </button>
            </div>

            {/* 検索・フィルタセクション */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 検索ボックス */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    検索
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="企業名、住所、担当者、連絡先で検索"
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

                {/* ステータスフィルタ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ステータス
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">すべてのステータス</option>
                    <option value="active">アクティブ</option>
                    <option value="inactive">非アクティブ</option>
                  </select>
                </div>
              </div>

              {/* フィルタ情報とクリアボタン */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {filteredPartners.length} 件中 {startIndex + 1}-{Math.min(endIndex, filteredPartners.length)} 件を表示
                  {(searchTerm || statusFilter) && (
                    <span className="ml-2">
                      (フィルタ適用中: 全 {partners.length} 件)
                    </span>
                  )}
                </div>
                {(searchTerm || statusFilter) && (
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
                      企業名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      連絡先
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      担当者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      契約期間
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentPartners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {(searchTerm || statusFilter) 
                              ? 'フィルタ条件に一致するパートナー企業が見つかりません'
                              : 'パートナー企業が登録されていません'
                            }
                          </h3>
                          <p className="text-gray-500 mb-4">
                            {(searchTerm || statusFilter)
                              ? 'フィルタ条件を変更するか、フィルタをクリアしてください。'
                              : '新規パートナー登録ボタンから最初の企業を登録してください。'
                            }
                          </p>
                          {(searchTerm || statusFilter) && (
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
                    currentPartners.map((partner) => (
                      <tr key={partner.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {partner.name}
                            </div>
                            {partner.address && (
                              <div className="text-xs text-gray-500">
                                {partner.address}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {partner.phoneNumber && (
                              <div>TEL: {partner.phoneNumber}</div>
                            )}
                            {partner.email && (
                              <div>Email: {partner.email}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {partner.contactPerson || "未設定"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {partner.contractStartDate && (
                              <div>開始: {new Date(partner.contractStartDate).toLocaleDateString('ja-JP')}</div>
                            )}
                            {partner.contractEndDate && (
                              <div>終了: {new Date(partner.contractEndDate).toLocaleDateString('ja-JP')}</div>
                            )}
                            {!partner.contractStartDate && !partner.contractEndDate && (
                              <span className="text-gray-500">未設定</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            partner.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {partner.isActive ? 'アクティブ' : '非アクティブ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() => handleEditPartner(partner)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDeletePartner(partner.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              削除
                            </button>
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
                      <span className="font-medium">{filteredPartners.length}</span> 件中{' '}
                      <span className="font-medium">{startIndex + 1}</span> - {' '}
                      <span className="font-medium">{Math.min(endIndex, filteredPartners.length)}</span> 件を表示
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

          </div>
        </div>
      </div>

      {/* 新規パートナー企業作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
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
              <form onSubmit={handleCreatePartner} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 左カラム - 基本情報 */}
                  <div className="space-y-6">
                    <div className="bg-orange-50 rounded-xl p-6 border border-orange-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-orange-900">基本情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            企業名 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 株式会社サンプル"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ユーザーIDプレフィックス <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.userIdPrefix}
                            onChange={(e) => setFormData(prev => ({ ...prev, userIdPrefix: e.target.value.toUpperCase() }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: COMP"
                            maxLength={4}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">4文字の英数字（自動で大文字に変換）</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            担当者名
                          </label>
                          <input
                            type="text"
                            value={formData.contactPerson}
                            onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 山田太郎"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            住所
                          </label>
                          <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 東京都渋谷区..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右カラム - 連絡先・契約情報 */}
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-blue-900">連絡先情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            電話番号
                          </label>
                          <input
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 03-1234-5678"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            メールアドレス
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: contact@company.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-purple-900">契約情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            契約開始日
                          </label>
                          <input
                            type="date"
                            value={formData.contractStartDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, contractStartDate: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            契約終了日
                          </label>
                          <input
                            type="date"
                            value={formData.contractEndDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, contractEndDate: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            備考
                          </label>
                          <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200 h-20"
                            placeholder="契約内容や特記事項など"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <label className="flex items-center p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                          className="rounded border-green-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 mr-3"
                        />
                        <div>
                          <p className="font-medium text-green-900">アクティブな企業として設定</p>
                          <p className="text-sm text-green-700">チェックを入れると、この企業のユーザーがシステムを利用できます</p>
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

      {/* パートナー企業編集モーダル */}
      {showEditModal && selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
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
                    <h3 className="text-2xl font-bold text-white">パートナー企業情報編集</h3>
                    <p className="text-blue-100 text-sm">{selectedPartner.name} の情報を編集</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPartner(null);
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
              <form onSubmit={handleUpdatePartner} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 左カラム - 基本情報 */}
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-blue-900">基本情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            企業名 <span className="text-red-500">*</span>
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
                            ユーザーIDプレフィックス <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.userIdPrefix}
                            onChange={(e) => setFormData(prev => ({ ...prev, userIdPrefix: e.target.value.toUpperCase() }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: COMP"
                            maxLength={4}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">4文字の英数字（自動で大文字に変換）</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            担当者名
                          </label>
                          <input
                            type="text"
                            value={formData.contactPerson}
                            onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            住所
                          </label>
                          <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 東京都渋谷区..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右カラム - 連絡先・契約情報・設定 */}
                  <div className="space-y-6">
                    <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-green-900">連絡先情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            電話番号
                          </label>
                          <input
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-green-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: 03-1234-5678"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            メールアドレス
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-green-500 focus:ring-0 transition-all duration-200"
                            placeholder="例: contact@company.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-purple-900">契約情報</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            契約開始日
                          </label>
                          <input
                            type="date"
                            value={formData.contractStartDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, contractStartDate: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            契約終了日
                          </label>
                          <input
                            type="date"
                            value={formData.contractEndDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, contractEndDate: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            備考
                          </label>
                          <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-0 transition-all duration-200 h-20"
                            placeholder="契約内容や特記事項など"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <label className="flex items-center p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 mr-3"
                        />
                        <div>
                          <p className="font-medium text-amber-900">アクティブな企業として設定</p>
                          <p className="text-sm text-amber-700">チェックを入れると、この企業のユーザーがシステムを利用できます</p>
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
                      setSelectedPartner(null);
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
    </div>

    </PageAccessGuard>
  );
}