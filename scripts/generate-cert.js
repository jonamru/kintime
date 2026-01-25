const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, '..', 'certificates');

// 証明書ディレクトリが存在しない場合は作成
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

console.log('🔐 自己署名証明書を生成中...');

try {
  // OpenSSLを使用して自己署名証明書を生成
  const command = `openssl req -x509 -out ${certDir}/cert.pem -keyout ${certDir}/key.pem \
    -newkey rsa:2048 -nodes -sha256 \
    -subj "/CN=localhost" -extensions EXT -config <( \
    printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.3.25\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")`;

  execSync(command, { shell: '/bin/bash', stdio: 'inherit' });

  console.log('✅ 証明書の生成が完了しました！');
  console.log(`📁 証明書の場所: ${certDir}`);
  console.log('\n次のコマンドでHTTPSサーバーを起動できます:');
  console.log('npm run dev:https');

} catch (error) {
  console.error('❌ 証明書の生成に失敗しました:', error.message);
  console.log('\n代替方法:');
  console.log('1. mkcertを使用する方法:');
  console.log('   brew install mkcert');
  console.log('   mkcert -install');
  console.log('   mkcert localhost 127.0.0.1 172.16.0.6');
  console.log('   証明書をcertificatesディレクトリに移動');
}