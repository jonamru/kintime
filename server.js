const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // すべてのネットワークインターフェースでリッスン
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 証明書のパス
const certPath = path.join(__dirname, 'certificates', 'cert.pem');
const keyPath = path.join(__dirname, 'certificates', 'key.pem');

// 証明書の存在確認
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ 証明書が見つかりません！');
  console.error('先に以下のコマンドを実行してください:');
  console.error('npm run generate-cert');
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 HTTPS Server ready on https://localhost:${port}`);
    console.log(`📱 ネットワーク上: https://172.16.0.6:${port}`);
    console.log('\n⚠️  自己署名証明書を使用しています。');
    console.log('ブラウザで警告が表示される場合は、「詳細設定」→「続行」をクリックしてください。');
  });
});