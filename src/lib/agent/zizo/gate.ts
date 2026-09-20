// LeadOS — بوابة الإرسال البشري (SendGate)
// أي رسالة خروجة من زيزو لازم تعدي من هنا قبل ما تتبعت:
//   1) ساعات إنسان (مفيش رسايل 3 الفجر)
//   2) سقف يومي لكل قناة (حماية الحظر)
//   3) فجوة أدنى بين رسالتين (الإنسان مش بيبعت كل دقيقة)
//   4) توزيع على حسابات متعددة (أول ما صاحب الوكالة يجيب أكتر من حساب)
// المبدأ: الرسالة اللي البوابة ترفضها بترجع درافت مستني موافقة — مش بتتبعت خالص.
import { db } from "@/lib/db"
import { isHumanHours } from "./humanize"
import type { ZizoConfig } from "./services"

export const CHANNEL_CAPS: Record<string, number> = {
  WHATSAPP: 40, // واتساب بيحظر فوق ~50/يوم لحساب جديد — سقف آمن
  FACEBOOK: 25,
  INSTAGRAM: 20,
  TELEGRAM: 30,
  WEB: 50,
  MANUAL: 50,
}

export interface GateDecision {
  allowed: boolean
  reason: string
  account: string
}

/** حسابات القناة — أول ما صاحب الوكالة يزود أكتر من حساب عبر ZIZO_ACCOUNTS_<CHANNEL> التوزيع يشتغل لوحده */
export function accountsFor(channel: string): string[] {
  const env = process.env[`ZIZO_ACCOUNTS_${channel.toUpperCase()}`]
  const list = env ? env.split(",").map((a) => a.trim()).filter(Boolean) : []
  return list.length ? list : ["default"]
}

/** حساب الأقل استخدام النهاردة على القناة دي (round-robin بالحِمل) */
async function pickAccount(wsId: string, channel: string, startOfDay: Date): Promise<string> {
  // 1) حسابات الداتابيز الصالحة (PlatformAccount): ACTIVE أو COOLDOWN منتهي — WARMING مستبعد
  const dbAccounts = await db.platformAccount
    .findMany({ where: { workspaceId: wsId, platform: channel, status: { in: ["ACTIVE", "COOLDOWN"] } } })
    .catch(() => [])
  const now = new Date()
  const usable: Array<{ handle: string; sentToday: number; dailyLimit: number }> = []
  for (const a of dbAccounts) {
    if (a.cooldownUntil && a.cooldownUntil > now) continue
    if (a.lastSentAt && a.lastSentAt < startOfDay && a.sentToday > 0) {
      // تصفير عدّاد كسول — عدّاد اليوم القديم ميمنعش إرسال النهاردة
      await db.platformAccount.update({ where: { id: a.id }, data: { sentToday: 0 } }).catch(() => undefined)
    }
    const sentToday = a.lastSentAt && a.lastSentAt >= startOfDay ? a.sentToday : 0
    if (sentToday < a.dailyLimit) usable.push({ handle: a.handle, sentToday, dailyLimit: a.dailyLimit })
  }
  if (usable.length) {
    const sorted = [...usable].sort((x, y) => x.sentToday - y.sentToday)
    return sorted[0].handle
  }
  // 2) fallback: حسابات env
  const accounts = accountsFor(channel)
  if (accounts.length === 1) return accounts[0]
  const counts = await Promise.all(
    accounts.map(async (acc) => {
      const n = await db.message
        .count({ where: { direction: "OUT", author: "ZIZO", sentAt: { gte: startOfDay }, conversation: { workspaceId: wsId, channel } } })
        .catch(() => 0)
      return { acc, n }
    }),
  )
  counts.sort((a, b) => a.n - b.n)
  return counts[0].acc
}

/** قرار البوابة: الرسالة دي تتبعت دلوقتي ولا لأ؟ */
export async function gateCheck(wsId: string, channel: string, cfg: ZizoConfig, now = new Date()): Promise<GateDecision> {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const account = await pickAccount(wsId, channel, startOfDay)

  if (!isHumanHours(now)) {
    return { allowed: false, reason: "برة ساعات البشر — زيزو مش بيبعت 3 الفجر زي البوت", account }
  }

  const cap = Math.max(1, Math.min(cfg.maxDailyMessages, CHANNEL_CAPS[channel] ?? 25))
  // الرسايل المعدودة: كل خروجة مسجلة النهاردة (مبعتولة ولا درافت) — العد الأكثر أمانًا
  const sentToday = await db.message
    .count({
      where: {
        direction: "OUT",
        author: "ZIZO",
        sentAt: { gte: startOfDay },
        conversation: { workspaceId: wsId, channel },
      },
    })
    .catch(() => 0)
  if (sentToday >= cap) {
    return { allowed: false, reason: `خلصت حصة اليوم على ${channel} (${sentToday}/${cap}) — حماية الحظر`, account }
  }

  const last = await db.message.findFirst({
    where: { direction: "OUT", author: "ZIZO", conversation: { workspaceId: wsId, channel } },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  })
  if (last) {
    const gapMin = Math.floor((now.getTime() - last.sentAt.getTime()) / 60_000)
    if (gapMin < cfg.minGapMinutes) {
      return { allowed: false, reason: `بدري — آخر رسالة من ${gapMin} دقيقة والفجوة الآمنة ${cfg.minGapMinutes} دقيقة`, account }
    }
  }

  // تسجيل الحصة على حساب الداتابيز لو الرسالة هتخرج منه (multi-account accounting)
  await db.platformAccount
    .updateMany({
      where: { workspaceId: wsId, platform: channel, handle: account },
      data: { sentToday: { increment: 1 }, lastSentAt: now },
    })
    .catch(() => undefined)

  return { allowed: true, reason: `داخل الحصة (${sentToday}/${cap} النهاردة)`, account }
}
