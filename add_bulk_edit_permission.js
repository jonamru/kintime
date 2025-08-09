// 一括修正権限をロールに追加するスクリプト
// Node.jsで実行: node add_bulk_edit_permission.js

const fetch = require('node-fetch');

async function addBulkEditPermission() {
  try {
    // localhost:3000が起動していることを確認
    const response = await fetch('http://localhost:3000/api/admin/update-bulk-edit-permissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 実際のクッキーまたはAuthorizationヘッダーが必要な場合はここに追加
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 成功:', result.message);
      console.log('📊 更新されたロール数:', result.updatedRoles);
    } else {
      console.log('❌ エラー:', result.error);
    }
  } catch (error) {
    console.log('❌ 接続エラー:', error.message);
    console.log('💡 サーバーが起動していることを確認してください (npm run dev)');
  }
}

addBulkEditPermission();