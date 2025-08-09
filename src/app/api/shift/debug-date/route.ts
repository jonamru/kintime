import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { date, startTime, endTime } = await request.json();

    console.log("受信したデータ:", { date, startTime, endTime });

    // 元の処理
    const shiftDate = new Date(date);
    const localDate = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
    
    const dateString = `${shiftDate.getFullYear()}-${(shiftDate.getMonth() + 1).toString().padStart(2, '0')}-${shiftDate.getDate().toString().padStart(2, '0')}`;
    const startDateTime = new Date(`${dateString}T${startTime}:00`);
    const endDateTime = new Date(`${dateString}T${endTime}:00`);

    // 新しい処理（直接文字列で作成）
    const directStartDateTime = new Date(`${date}T${startTime}:00`);
    const directEndDateTime = new Date(`${date}T${endTime}:00`);
    
    // さらに別の方法
    const [year, month, day] = date.split('-').map(Number);
    const altLocalDate = new Date(year, month - 1, day);
    const altStartDateTime = new Date(year, month - 1, day, ...startTime.split(':').map(Number));
    const altEndDateTime = new Date(year, month - 1, day, ...endTime.split(':').map(Number));

    return NextResponse.json({
      input: { date, startTime, endTime },
      original: {
        shiftDate: shiftDate.toISOString(),
        localDate: localDate.toISOString(),
        dateString,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
      },
      direct: {
        startDateTime: directStartDateTime.toISOString(),
        endDateTime: directEndDateTime.toISOString(),
      },
      alternative: {
        localDate: altLocalDate.toISOString(),
        startDateTime: altStartDateTime.toISOString(),
        endDateTime: altEndDateTime.toISOString(),
      },
      timezone: {
        offset: new Date().getTimezoneOffset(),
        locale: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    });
  } catch (error) {
    console.error("日付デバッグエラー:", error);
    return NextResponse.json(
      { error: "日付デバッグに失敗しました" },
      { status: 500 }
    );
  }
}