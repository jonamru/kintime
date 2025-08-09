import { prisma } from "@/lib/prisma";

/**
 * ユーザーIDを自動生成する
 * 形式: [企業プレフィックス4文字][連番7桁]
 * 例: COMP0000001, PART0000001
 */
export async function generateUserId(partnerId?: string): Promise<string> {
  let prefix: string;

  if (partnerId) {
    // パートナー企業の場合、パートナーのプレフィックスを取得
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { userIdPrefix: true }
    });

    if (!partner || !partner.userIdPrefix) {
      throw new Error("パートナー企業のプレフィックスが設定されていません");
    }

    prefix = partner.userIdPrefix;
  } else {
    // 自社の場合、デフォルトプレフィックス "ADST" を使用
    prefix = "ADST";
  }

  // 同じプレフィックスを持つ最大の番号を取得
  const existingUsers = await prisma.user.findMany({
    where: {
      userId: {
        startsWith: prefix
      }
    },
    select: { userId: true },
    orderBy: { userId: 'desc' }
  });

  let nextNumber = 1;

  if (existingUsers.length > 0) {
    // 最新のユーザーIDから番号部分を抽出
    const latestUserId = existingUsers[0].userId;
    if (latestUserId && latestUserId.length === 11) { // 4文字プレフィックス + 7桁番号
      const numberPart = latestUserId.substring(4);
      const currentNumber = parseInt(numberPart, 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }
  }

  // 7桁でゼロパディング
  const paddedNumber = nextNumber.toString().padStart(7, '0');
  
  return `${prefix}${paddedNumber}`;
}

/**
 * プレフィックスの重複チェック
 */
export async function checkPrefixDuplicate(prefix: string, excludePartnerId?: string): Promise<boolean> {
  try {
    // システム設定のプレフィックスとの重複チェック
    const systemSetting = await prisma.systemSetting.findFirst();
    if (systemSetting && systemSetting.companyUserIdPrefix === prefix) {
      return true;
    }
  } catch (error) {
    console.log("SystemSetting table not found, skipping system prefix check:", error);
  }

  try {
    // パートナー企業のプレフィックスとの重複チェック
    const partner = await prisma.partner.findFirst({
      where: {
        userIdPrefix: prefix,
        ...(excludePartnerId && { id: { not: excludePartnerId } })
      }
    });

    return !!partner;
  } catch (error) {
    console.error("Error checking partner prefix:", error);
    return false;
  }
}