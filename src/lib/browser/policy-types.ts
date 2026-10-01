// LeadOS — أنواع سياسات المتصفحات (منفصلة لتستوردها ملفات السياسات دون دورة استيراد)
export type BrowserAccessMode = "SESSION_REQUIRED" | "SESSION_OPTIONAL" | "PUBLIC_ONLY"
export type BrowserTaskType = "GROUPS_SCAN" | "RADAR_SCAN" | "PUBLIC_FETCH" | "ADS_LIBRARY"

export interface PlatformPolicy {
  platform: string
  accessMode: BrowserAccessMode
  browserJobs: BrowserTaskType[]
  sessionRequiredJobs: BrowserTaskType[]
  maxConcurrentBrowsers: number
  maxJobsPerBrowser: number
  minDelayMs: number
  maxDelayMs: number
  maxActionsPerWindow: number
  windowMs: number
  cooldownAfterGenerationMs: number
  activeHours: { start: number; end: number; tz: string }
  retryPolicy: { maxAttempts: number; backoffBaseMs: number }
  sessionHealthIntervalMs: number
  failureBackoffMs: number
  maxJobsPerGeneration: number
  generationCadenceMs: number
  notes: string
}
