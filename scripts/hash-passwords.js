// パスワードハッシュ化スクリプト
// 使用方法: node scripts/hash-passwords.js

async function hashPasswords() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/hash-passwords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secretKey: 'hash-all-passwords-2024'
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('結果:', result);
  } catch (error) {
    console.error('エラー:', error);
  }
}

hashPasswords();