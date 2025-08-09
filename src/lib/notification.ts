// グローバルな通知関数
let notificationInstance: any = null;

export const setNotificationInstance = (instance: any) => {
  notificationInstance = instance;
};

export const showAlert = (message: string) => {
  if (notificationInstance) {
    // エラーメッセージの判定
    if (message.includes('失敗') || message.includes('エラー') || message.includes('できません')) {
      notificationInstance.showNotification('error', message);
    } else if (message.includes('注意') || message.includes('確認')) {
      notificationInstance.showNotification('warning', message);
    } else {
      notificationInstance.showNotification('success', message);
    }
  } else {
    // フォールバック
    alert(message);
  }
};

export const showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
  if (notificationInstance) {
    notificationInstance.showNotification(type, message);
  } else {
    // フォールバック
    alert(message);
  }
};

export const showConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (notificationInstance) {
      notificationInstance.showConfirm({
        message,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    } else {
      // フォールバック
      resolve(confirm(message));
    }
  });
};