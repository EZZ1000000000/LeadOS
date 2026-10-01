// LeadOS — سياسة المنصة التشغيلية (مولّدة من scripts/gen-platform-policies.mjs — طلب §8/§15)
// تعديل السياسة = عدّل القيم هنا ثم شغّل المولّد أو حدّث يدويًا — لا منطق تشغيلي في هذا الملف.
import type { PlatformPolicy } from "@/lib/browser/policy-types"

export const facebookPolicy: PlatformPolicy = {
  "platform": "FACEBOOK",
  "accessMode": "SESSION_OPTIONAL",
  "browserJobs": [
    "GROUPS_SCAN",
    "RADAR_SCAN",
    "PUBLIC_FETCH",
    "ADS_LIBRARY"
  ],
  "sessionRequiredJobs": [
    "GROUPS_SCAN",
    "RADAR_SCAN"
  ],
  "maxConcurrentBrowsers": 2,
  "maxJobsPerBrowser": 10,
  "minDelayMs": 2000,
  "maxDelayMs": 7000,
  "maxActionsPerWindow": 30,
  "windowMs": 600000,
  "cooldownAfterGenerationMs": 180000,
  "activeHours": {
    "start": 0,
    "end": 24,
    "tz": "Africa/Cairo"
  },
  "retryPolicy": {
    "maxAttempts": 3,
    "backoffBaseMs": 60000
  },
  "sessionHealthIntervalMs": 300000,
  "failureBackoffMs": 1200000,
  "maxJobsPerGeneration": 8,
  "generationCadenceMs": 900000,
  "notes": "فيسبوك: التصفح عبر mbasic للمحتوى العام والمسجَّل؛ أي checkpoint/حظر → BACKOFF فوري بلا إعادة محاولة متلاحقة"
}
