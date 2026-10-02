// LeadOS — سياسة المنصة التشغيلية (مولّدة من scripts/gen-platform-policies.mjs — طلب §8/§15)
// تعديل السياسة = عدّل القيم هنا ثم شغّل المولّد أو حدّث يدويًا — لا منطق تشغيلي في هذا الملف.
import type { PlatformPolicy } from "@/lib/browser/policy-types"

export const whatsappPolicy: PlatformPolicy = {
  "platform": "WHATSAPP",
  "accessMode": "SESSION_REQUIRED",
  "browserJobs": [],
  "sessionRequiredJobs": [],
  "maxConcurrentBrowsers": 0,
  "maxJobsPerBrowser": 12,
  "minDelayMs": 1500,
  "maxDelayMs": 5000,
  "maxActionsPerWindow": 40,
  "windowMs": 600000,
  "cooldownAfterGenerationMs": 120000,
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
  "notes": "واتساب: قناة مراسلة (worker) — ليست نطاق browser runtime؛ الجلسة تُدار خارج هذا الملف"
}
