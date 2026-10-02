// LeadOS — سياسة المنصة التشغيلية (مولّدة من scripts/gen-platform-policies.mjs — طلب §8/§15)
// تعديل السياسة = عدّل القيم هنا ثم شغّل المولّد أو حدّث يدويًا — لا منطق تشغيلي في هذا الملف.
import type { PlatformPolicy } from "@/lib/browser/policy-types"

export const linkedinPolicy: PlatformPolicy = {
  "platform": "LINKEDIN",
  "accessMode": "SESSION_OPTIONAL",
  "browserJobs": [
    "PUBLIC_FETCH"
  ],
  "sessionRequiredJobs": [],
  "maxConcurrentBrowsers": 1,
  "maxJobsPerBrowser": 12,
  "minDelayMs": 4000,
  "maxDelayMs": 9000,
  "maxActionsPerWindow": 15,
  "windowMs": 900000,
  "cooldownAfterGenerationMs": 600000,
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
  "failureBackoffMs": 3600000,
  "maxJobsPerGeneration": 5,
  "generationCadenceMs": 900000,
  "notes": "لينكدإن: authwall صارم — الجلب العام فقط، أي authwall → NEEDS_SESSION بلا محاولة تجاوز"
}
