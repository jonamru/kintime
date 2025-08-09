"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setNotificationInstance } from '@/lib/notification';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  onClose?: () => void;
}

interface ConfirmOptions {
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string) => void;
  showConfirm: (options: ConfirmOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);

  const closeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((type: NotificationType, message: string) => {
    const id = Date.now().toString();
    const notification: Notification = {
      id,
      type,
      message,
    };
    setNotifications(prev => [...prev, notification]);
    
    // 成功通知は自動的に3秒後に閉じる
    if (type === 'success') {
      setTimeout(() => {
        closeNotification(id);
      }, 3000);
    }
  }, [closeNotification]);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setConfirmDialog(options);
  }, []);

  useEffect(() => {
    // グローバルインスタンスを設定
    setNotificationInstance({ showNotification, showConfirm });
  }, [showNotification, showConfirm]);


  const handleConfirm = () => {
    if (confirmDialog) {
      confirmDialog.onConfirm();
      setConfirmDialog(null);
    }
  };

  const handleCancel = () => {
    if (confirmDialog) {
      confirmDialog.onCancel?.();
      setConfirmDialog(null);
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
    }
  };

  const getColorClasses = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getButtonClasses = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700 text-white';
      case 'error':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  // 最初の通知のみ表示
  const currentNotification = notifications[0];

  return (
    <NotificationContext.Provider value={{ showNotification, showConfirm }}>
      {children}
      
      {/* トースト通知表示 */}
      {currentNotification && (
        <div className="fixed top-4 right-4 z-50 pointer-events-auto animate-slide-in">
          <div className={`max-w-sm w-full p-4 rounded-lg shadow-lg border ${getColorClasses(currentNotification.type)} cursor-pointer`}
               onClick={() => closeNotification(currentNotification.id)}>
            <div className="flex items-center space-x-3">
              <span className="text-xl">{getIcon(currentNotification.type)}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{currentNotification.message}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeNotification(currentNotification.id);
                }}
                className="text-gray-400 hover:text-gray-600 ml-2"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 確認ダイアログ */}
      {confirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="pointer-events-auto max-w-md w-full mx-4 p-6 rounded-lg shadow-lg border bg-yellow-50 border-yellow-200 text-yellow-800">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium whitespace-pre-line">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors"
              >
                いいえ
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-md text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};