// LeadOS — محمّل سياسات المنصات (طلب §8 + §15)
// كل منصة لها ملف config مستقل بالقواعد التشغيلية فقط — لا سياسة موحدة للجميع.
// الملفات: src/config/platform-policies/<platform>.ts (تتولد من scripts/gen-platform-policies.mjs)
import { facebookPolicy } from "../../config/platform-policies/facebook"
import { instagramPolicy } from "../../config/platform-policies/instagram"
import { linkedinPolicy } from "../../config/platform-policies/linkedin"
import { xPolicy } from "../../config/platform-policies/x"
import { tiktokPolicy } from "../../config/platform-policies/tiktok"
import { redditPolicy } from "../../config/platform-policies/reddit"
import { telegramPolicy } from "../../config/platform-policies/telegram"
import { discordPolicy } from "../../config/platform-policies/discord"
import { youtubePolicy } from "../../config/platform-policies/youtube"
import { whatsappPolicy } from "../../config/platform-policies/whatsapp"
import type { PlatformPolicy, BrowserAccessMode, BrowserTaskType } from "./policy-types"

export type { PlatformPolicy, BrowserAccessMode, BrowserTaskType }

const RAW: Record<string, PlatformPolicy> = {
  FACEBOOK: facebookPolicy,
  INSTAGRAM: instagramPolicy,
  LINKEDIN: linkedinPolicy,
  X: xPolicy,
  TIKTOK: tiktokPolicy,
  REDDIT: redditPolicy,
  TELEGRAM: telegramPolicy,
  DISCORD: discordPolicy,
  YOUTUBE: youtubePolicy,
  WHATSAPP: whatsappPolicy,
}

const POLICIES: Record<string, PlatformPolicy> = {}
for (const [platform, p] of Object.entries(RAW)) {
  if (!p || typeof p !== "object") continue
  POLICIES[platform] = {
    ...p,
    // حدود أمان صارمة حتى لو اتعدل ملف السياسة غلط
    maxConcurrentBrowsers: Math.max(0, Math.min(Number(p.maxConcurrentBrowsers) || 0, 5)),
    maxJobsPerGeneration: Math.max(1, Math.min(Number(p.maxJobsPerGeneration) || 10, 25)),
    maxActionsPerWindow: Math.max(1, Math.min(Number(p.maxActionsPerWindow) || 40, 200)),
    minDelayMs: Math.max(500, Number(p.minDelayMs) || 1500),
    maxDelayMs: Math.max(Number(p.minDelayMs) || 1500, Number(p.maxDelayMs) || 5000),
  }
}

/** سياسة منصة — undefined لو مفيش ملف (المتصفح لا يعمل بلا سياسة: Compliance Guard) */
export function policyFor(platform: string): PlatformPolicy | undefined {
  return POLICIES[platform?.toUpperCase()]
}

export function allPolicies(): PlatformPolicy[] {
  return Object.values(POLICIES)
}

/** تأخير بشري عشوائي داخل حدود السياسة (طلب §10 — pacing ضمن الحدود المسموحة فقط) */
export function pacingDelayMs(policy: PlatformPolicy): number {
  const span = Math.max(0, policy.maxDelayMs - policy.minDelayMs)
  return policy.minDelayMs + Math.floor(Math.random() * span)
}

/** هل الوقت الحالي داخل ساعات النشاط المسموحة للمنصة (بحسب توقيت المنصة) */
export function withinActiveHours(policy: PlatformPolicy, now = new Date()): boolean {
  try {
    const { start, end, tz } = policy.activeHours
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(now))
    if (start <= end) return hour >= start && hour < end
    return hour >= start || hour < end // نافذة تتجاوز منتصف الليل
  } catch {
    return true // توقيت غير معروف → لا نمنع ظلمًا (الساعات ليست حماية حرجة)
  }
}
