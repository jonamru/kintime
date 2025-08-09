const fs = require('fs');
const path = require('path');

// 置き換え対象のディレクトリ
const targetDirs = [
  path.join(__dirname, '../src/app'),
  path.join(__dirname, '../src/components'),
];

// ファイルを再帰的に検索
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// alert()の置き換え
function replaceAlerts(content, filePath) {
  let modified = content;
  let hasChanges = false;
  
  // alert()を検出して置き換え
  const alertRegex = /\balert\s*\(\s*([^)]+)\s*\)/g;
  if (alertRegex.test(content)) {
    hasChanges = true;
    
    // importを追加（まだない場合）
    if (!content.includes("import { showAlert")) {
      const importRegex = /^(import\s+.*?from\s+['"].*?['"];?\s*\n)+/m;
      const importMatch = content.match(importRegex);
      
      if (importMatch) {
        modified = content.replace(importMatch[0], importMatch[0] + "import { showAlert } from '@/lib/notification';\n");
      } else {
        // 最初のimportがない場合は、ファイルの先頭に追加
        modified = "import { showAlert } from '@/lib/notification';\n" + content;
      }
    }
    
    // alert()をshowAlert()に置き換え
    modified = modified.replace(alertRegex, 'showAlert($1)');
  }
  
  return { content: modified, hasChanges };
}

// confirm()の置き換え
function replaceConfirms(content, filePath) {
  let modified = content;
  let hasChanges = false;
  
  // confirm()を検出
  const confirmRegex = /\bconfirm\s*\(\s*([^)]+)\s*\)/g;
  const matches = [...content.matchAll(confirmRegex)];
  
  if (matches.length > 0) {
    hasChanges = true;
    
    // importを追加（まだない場合）
    if (!content.includes("import { showConfirm")) {
      if (content.includes("import { showAlert")) {
        modified = modified.replace(
          "import { showAlert } from '@/lib/notification';",
          "import { showAlert, showConfirm } from '@/lib/notification';"
        );
      } else {
        const importRegex = /^(import\s+.*?from\s+['"].*?['"];?\s*\n)+/m;
        const importMatch = modified.match(importRegex);
        
        if (importMatch) {
          modified = modified.replace(importMatch[0], importMatch[0] + "import { showConfirm } from '@/lib/notification';\n");
        } else {
          modified = "import { showConfirm } from '@/lib/notification';\n" + modified;
        }
      }
    }
    
    // confirm()の使用パターンを検出して適切に置き換え
    // if (confirm(...)) パターン
    modified = modified.replace(/if\s*\(\s*confirm\s*\(\s*([^)]+)\s*\)\s*\)/g, 'if (await showConfirm($1))');
    
    // if (!confirm(...)) パターン
    modified = modified.replace(/if\s*\(\s*!\s*confirm\s*\(\s*([^)]+)\s*\)\s*\)/g, 'if (!(await showConfirm($1)))');
    
    // const result = confirm(...) パターン
    modified = modified.replace(/const\s+(\w+)\s*=\s*confirm\s*\(\s*([^)]+)\s*\)/g, 'const $1 = await showConfirm($2)');
    
    // 関数をasyncに変更する必要がある
    matches.forEach(() => {
      // 関数定義を探してasyncを追加
      const functionPatterns = [
        /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*{/g,
        /function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
        /(\w+)\s*\(([^)]*)\)\s*{/g,
      ];
      
      functionPatterns.forEach(pattern => {
        modified = modified.replace(pattern, (match) => {
          if (!match.includes('async')) {
            return match.replace(/const\s+/, 'const ').replace(/function\s+/, 'async function ').replace(/=>\s*{/, '=> {').replace(/^(\w+)/, 'async $1');
          }
          return match;
        });
      });
    });
  }
  
  return { content: modified, hasChanges };
}

// メイン処理
async function main() {
  let totalFiles = 0;
  let modifiedFiles = 0;
  
  targetDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Directory not found: ${dir}`);
      return;
    }
    
    const files = findFiles(dir);
    totalFiles += files.length;
    
    files.forEach(filePath => {
      let content = fs.readFileSync(filePath, 'utf8');
      let hasChanges = false;
      
      // NotificationContext.tsxとnotification.tsはスキップ
      if (filePath.includes('NotificationContext.tsx') || filePath.includes('notification.ts')) {
        return;
      }
      
      // alert()の置き換え
      const alertResult = replaceAlerts(content, filePath);
      if (alertResult.hasChanges) {
        content = alertResult.content;
        hasChanges = true;
      }
      
      // confirm()の置き換え
      const confirmResult = replaceConfirms(content, filePath);
      if (confirmResult.hasChanges) {
        content = confirmResult.content;
        hasChanges = true;
      }
      
      // 変更があれば保存
      if (hasChanges) {
        fs.writeFileSync(filePath, content);
        console.log(`Modified: ${filePath}`);
        modifiedFiles++;
      }
    });
  });
  
  console.log(`\nTotal files scanned: ${totalFiles}`);
  console.log(`Files modified: ${modifiedFiles}`);
}

main().catch(console.error);