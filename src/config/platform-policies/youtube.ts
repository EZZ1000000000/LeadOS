// LeadOS — سياسة المنصة التشغيلية (مولّدة من scripts/gen-platform-policies.mjs — طلب §8/§15)
// تعديل السياسة = عدّل القيم هنا ثم شغّل المولّد أو حدّث يدويًا — لا منطق تشغيلي في هذا الملف.
import type { PlatformPolicy } from "@/lib/browser/policy-types"

export const youtubePolicy: PlatformPolicy = {
  "platform": "YOUTUBE",
  "accessMode": "PUBLIC_ONLY",
  "browserJobs": [
    "PUBLIC_FETCH"
  ],
  "sessionRequiredJobs": [],
  "maxConcurrentBrowsers": 1,
  "maxJobsPerBrowser": 12,
  "minDelayMs": 2000,
  "maxDelayMs": 5000,
  "maxActionsPerWindow": 30,
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
  "notes": "يوتيوب: قنوات وأوصاف فيديو عامة"
}
