// LeadOS — سياسة المنصة التشغيلية (مولّدة من scripts/gen-platform-policies.mjs — طلب §8/§15)
// تعديل السياسة = عدّل القيم هنا ثم شغّل المولّد أو حدّث يدويًا — لا منطق تشغيلي في هذا الملف.
import type { PlatformPolicy } from "@/lib/browser/policy-types"

export const xPolicy: PlatformPolicy = {
  "platform": "X",
  "accessMode": "SESSION_OPTIONAL",
  "browserJobs": [
    "PUBLIC_FETCH"
  ],
  "sessionRequiredJobs": [],
  "maxConcurrentBrowsers": 1,
  "maxJobsPerBrowser": 12,
  "minDelayMs": 3000,
  "maxDelayMs": 8000,
  "maxActionsPerWindow": 20,
  "windowMs": 600000,
  "cooldownAfterGenerationMs": 300000,
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
  "notes": "X: صفحات عامة فقط؛ جدار تسجيل الدخول → NEEDS_SESSION"
}
