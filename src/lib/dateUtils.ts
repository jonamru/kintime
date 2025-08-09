/**
 * 日本時間処理ユーティリティ
 * このシステムでは日本時間（JST/UTC+9）を絶対的な基準とする
 */

// 日本のタイムゾーン
const JAPAN_TIMEZONE = 'Asia/Tokyo';

/**
 * 現在の日本時間を取得
 */
export function getJapanNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: JAPAN_TIMEZONE }));
}

/**
 * 日本時間で今日の日付文字列を取得 (YYYY-MM-DD)
 */
export function getJapanTodayString(): string {
  const now = getJapanNow();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日本時間で指定日の開始時刻と終了時刻を取得
 * @param dateString YYYY-MM-DD形式の日付文字列
 */
export function getJapanDayRange(dateString: string): { startOfDay: Date; endOfDay: Date } {
  const [year, month, day] = dateString.split('-').map(Number);
  
  // 日本時間での日付を作成
  const startOfDay = new Date();
  startOfDay.setFullYear(year, month - 1, day);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setFullYear(year, month - 1, day);
  endOfDay.setHours(23, 59, 59, 999);
  
  return { startOfDay, endOfDay };
}

/**
 * 日本時間で月の開始と終了を取得
 * @param year 年
 * @param month 月（1-12）
 */
export function getJapanMonthRange(year: number, month: number): { startOfMonth: Date; endOfMonth: Date } {
  const startOfMonth = new Date();
  startOfMonth.setFullYear(year, month - 1, 1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const endOfMonth = new Date();
  endOfMonth.setFullYear(year, month, 0); // 次の月の0日 = 今月の最終日
  endOfMonth.setHours(23, 59, 59, 999);
  
  return { startOfMonth, endOfMonth };
}

/**
 * DateオブジェクトをYYYY-MM-DD形式の文字列に変換（日本時間基準）
 */
export function formatJapanDate(date: Date): string {
  const japanDate = new Date(date.toLocaleString('en-US', { timeZone: JAPAN_TIMEZONE }));
  const year = japanDate.getFullYear();
  const month = String(japanDate.getMonth() + 1).padStart(2, '0');
  const day = String(japanDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * DateオブジェクトをHH:MM形式の時刻文字列に変換（日本時間基準）
 */
export function formatJapanTime(date: Date): string {
  const japanDate = new Date(date.toLocaleString('en-US', { timeZone: JAPAN_TIMEZONE }));
  const hours = String(japanDate.getHours()).padStart(2, '0');
  const minutes = String(japanDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * DateオブジェクトをYYYY-MM-DD HH:MM:SS形式に変換（日本時間基準）
 */
export function formatJapanDateTime(date: Date): string {
  const japanDate = new Date(date.toLocaleString('en-US', { timeZone: JAPAN_TIMEZONE }));
  const year = japanDate.getFullYear();
  const month = String(japanDate.getMonth() + 1).padStart(2, '0');
  const day = String(japanDate.getDate()).padStart(2, '0');
  const hours = String(japanDate.getHours()).padStart(2, '0');
  const minutes = String(japanDate.getMinutes()).padStart(2, '0');
  const seconds = String(japanDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * YYYY-MM-DD形式の日付文字列と時刻から日本時間のDateオブジェクトを作成
 * @param dateString YYYY-MM-DD形式
 * @param timeString HH:MM形式
 */
export function createJapanDateTime(dateString: string, timeString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);
  
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(hours, minutes, 0, 0);
  
  return date;
}

/**
 * 日本時間で日付が今日かどうかをチェック
 */
export function isJapanToday(date: Date): boolean {
  const todayString = getJapanTodayString();
  const dateString = formatJapanDate(date);
  return todayString === dateString;
}

/**
 * 日本時間で2つの日付が同じ日かどうかをチェック
 */
export function isSameJapanDay(date1: Date, date2: Date): boolean {
  return formatJapanDate(date1) === formatJapanDate(date2);
}