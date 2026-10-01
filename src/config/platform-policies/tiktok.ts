// LeadOS — سياسة المنصة التشغيلية (مولّدة من scripts/gen-platform-policies.mjs — طلب §8/§15)
// تعديل السياسة = عدّل القيم هنا ثم شغّل المولّد أو حدّث يدويًا — لا منطق تشغيلي في هذا الملف.
import type { PlatformPolicy } from "@/lib/browser/policy-types"

export const tiktokPolicy: PlatformPolicy = {
  "platform": "TIKTOK",
  "accessMode": "SESSION_OPTIONAL",
  "browserJobs": [
    "PUBLIC_FETCH"
  ],
  "sessionRequiredJobs": [],
  "maxConcurrentBrowsers": 1,
  "maxJobsPerBrowser": 12,
  "minDelayMs": 2500,
  "maxDelayMs": 6000,
  "maxActionsPerWindow": 25,
  "windowMs": 600000,
  "cooldownAfterGenerationMs": 240000,
  "activeHours": {
    "start": 8,
    "end": 24,
    "tz": "Africa/Cairo"
  },
  "retryPolicy": {
    "maxAttempts": 3,
    "backoffBaseMs": 60000
  },
  "sessionHealthIntervalMs": 300000,
  "failureBackoffMs": 900000,
  "maxJobsPerGeneration": 10,
  "generationCadenceMs": 900000,
  "notes": "تيك توك: بروفايلات وفيديوهات عامة"
}
