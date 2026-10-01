// LeadOS — سياسة المنصة التشغيلية (مولّدة من scripts/gen-platform-policies.mjs — طلب §8/§15)
// تعديل السياسة = عدّل القيم هنا ثم شغّل المولّد أو حدّث يدويًا — لا منطق تشغيلي في هذا الملف.
import type { PlatformPolicy } from "@/lib/browser/policy-types"

export const telegramPolicy: PlatformPolicy = {
  "platform": "TELEGRAM",
  "accessMode": "PUBLIC_ONLY",
  "browserJobs": [
    "PUBLIC_FETCH"
  ],
  "sessionRequiredJobs": [],
  "maxConcurrentBrowsers": 1,
  "maxJobsPerBrowser": 12,
  "minDelayMs": 1500,
  "maxDelayMs": 4000,
  "maxActionsPerWindow": 50,
  "windowMs": 600000,
  "cooldownAfterGenerationMs": 60000,
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
  "notes": "تليجرام: قنوات عامة t.me/s/ فقط"
}
