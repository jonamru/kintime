import { NextResponse } from "next/server";

interface ParseResult {
  date?: string;
  departure?: string;
  arrival?: string;
  amount?: number;
  route?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  transfers?: number;
  referenceUrl?: string;
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "テキストが指定されていません" }, { status: 400 });
    }

    console.log("解析対象テキスト:", text);
    
    const result: ParseResult = {};

    // 日付の抽出 "2025年7月26日(土)" 形式
    const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      const day = dateMatch[3].padStart(2, '0');
      result.date = `${year}-${month}-${day}`;
    }

    // Yahoo!乗換案内の新しい形式に対応
    // パターン1: "寝屋川公園 ⇒ 松井山手" 形式（スペースを含む施設名に対応）
    let stationMatch = text.match(/([^⇒\n]+?)\s*⇒\s*([^⇒\n]+)/);
    
    // パターン2: "■駅名" 形式で出発地・到着地を抽出
    if (!stationMatch) {
      const stationMarkers = text.match(/■([^\n\r]+)/g);
      if (stationMarkers && stationMarkers.length >= 2) {
        const departure = stationMarkers[0].replace('■', '').trim();
        const arrival = stationMarkers[stationMarkers.length - 1].replace('■', '').trim();
        result.departure = departure;
        result.arrival = arrival;
      }
    } else {
      result.departure = stationMatch[1].trim();
      result.arrival = stationMatch[2].trim();
    }

    // 運賃の抽出 (複数パターンに対応)
    // パターン1: "運賃[IC優先] 1,180円" (カンマ区切りに対応)
    let amountMatch = text.match(/運賃[^\d]*([0-9,]+)円/);
    
    // パターン2: "1,180円" (単純な円表記、カンマ区切り)
    if (!amountMatch) {
      amountMatch = text.match(/([0-9,]+)円/);
    }
    
    // パターン3: "¥1,180" や "￥1,180"
    if (!amountMatch) {
      amountMatch = text.match(/[¥￥]([0-9,]+)/);
    }
    
    if (amountMatch) {
      // カンマを除去して数値に変換
      result.amount = parseInt(amountMatch[1].replace(/,/g, ''));
    }

    // 経路の抽出（複数路線を→で区切って表示）
    const routeLines: string[] = [];
    
    // ↓ から始まる路線情報を抽出（徒歩を除外）
    const routeMatches = text.match(/↓\s*(ＪＲ[^\n]+|JR[^\n]+|東京メトロ[^\n]+|OsakaMetro[^\n]+|京急[^\n]+|小田急[^\n]+|東急[^\n]+|西武[^\n]+|京王[^\n]+|都営[^\n]+|阪急[^\n]+|阪神[^\n]+|近鉄[^\n]+|南海[^\n]+|京阪[^\n]+|神戸高速線[^\n]+|神鉄[^\n]+|北大阪急行電鉄[^\n]*|泉北高速鉄道[^\n]+|大阪モノレール[^\n]+|京阪バス[^\n]*|[^\n]*バス[^\n]*)/g);
    
    if (routeMatches && routeMatches.length > 0) {
      routeMatches.forEach((match: string) => {
        let route = match.replace('↓', '').trim();
        
        // 行き先（○○行）を除去
        route = route.replace(/\s+[^\s]*行$/, '').trim();
        
        // 徒歩関連を除外
        if (route.includes('徒歩') || route.includes('駅内徒歩')) {
          return;
        }
        
        // 路線名のみを抽出（最初の空白までを取得）
        const spaceIndex = route.indexOf(' ');
        if (spaceIndex > 0) {
          route = route.substring(0, spaceIndex);
        }
        
        // 種別（快速、急行など）を除去して基本路線名を取得
        let baseRoute = route;
        baseRoute = baseRoute.replace(/(快速|急行|準急|普通|各停|特急|新快速|区間快速|区間急行|通勤快速|通勤急行)$/, '').trim();
        
        // 同じ基本路線名が既に存在するかチェック
        const existingRoute = routeLines.find(existing => {
          const existingBase = existing.replace(/(快速|急行|準急|普通|各停|特急|新快速|区間快速|区間急行|通勤快速|通勤急行)$/, '').trim();
          return existingBase === baseRoute;
        });
        
        if (!existingRoute && baseRoute) {
          routeLines.push(baseRoute);
        }
      });
      
      if (routeLines.length > 0) {
        result.route = routeLines.join(' → ');
      }
    }
    
    // 単一路線の場合のフォールバック
    if (!result.route) {
      let routeMatch = text.match(/(ＪＲ[^\s\n行]+|JR[^\s\n行]+|東京メトロ[^\s\n行]+|OsakaMetro[^\s\n行]+|京急[^\s\n行]+|小田急[^\s\n行]+|東急[^\s\n行]+|西武[^\s\n行]+|京王[^\s\n行]+|都営[^\s\n行]+|阪急[^\s\n行]+|阪神[^\s\n行]+|近鉄[^\s\n行]+|南海[^\s\n行]+|京阪[^\s\n行]+|北大阪急行電鉄[^\s\n行]*|泉北高速鉄道[^\s\n行]+|大阪モノレール[^\s\n行]+)/);
      
      if (routeMatch) {
        // "同志社前行" などの行き先を除去
        result.route = routeMatch[1].replace(/[行]$/, '').trim();
      }
    }

    // 出発時刻・到着時刻の抽出
    const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*⇒\s*(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      result.departureTime = `${timeMatch[1]}:${timeMatch[2]}`;
      result.arrivalTime = `${timeMatch[3]}:${timeMatch[4]}`;
    }

    // 所要時間の抽出 (時間分形式に対応)
    const durationMatch = text.match(/所要時間\s*(\d+時間)?(\d+)分/);
    if (durationMatch) {
      let duration = '';
      if (durationMatch[1]) {
        // "6時間51分" 形式
        const hours = durationMatch[1].replace('時間', '');
        duration = `${hours}時間${durationMatch[2]}分`;
      } else {
        // "15分" 形式
        duration = `${durationMatch[2]}分`;
      }
      result.duration = duration;
    }

    // 乗換回数の抽出
    const transferMatch = text.match(/乗換\s*(\d+)回/);
    if (transferMatch) {
      result.transfers = parseInt(transferMatch[1]);
    }

    // Yahoo!乗換案内のURL抽出
    // パターン1: "https://yahoo.jp/xxxx" 形式
    let urlMatch = text.match(/https?:\/\/yahoo\.jp\/[A-Za-z0-9]+/);
    
    // パターン2: URLが改行されている場合
    if (!urlMatch) {
      urlMatch = text.match(/★PC・スマホでこの検索結果を見る[\s\n]+(https?:\/\/yahoo\.jp\/[A-Za-z0-9]+)/);
    }
    
    if (urlMatch) {
      result.referenceUrl = urlMatch[1] || urlMatch[0];
    }

    console.log("解析結果:", result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("交通費解析エラー:", error);
    return NextResponse.json(
      { error: "交通費の解析に失敗しました" },
      { status: 500 }
    );
  }
}