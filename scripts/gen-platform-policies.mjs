// LeadOS — مولّد ملفات سياسات المنصات (طلب §8 + §15)
// كل منصة لها ملف config مستقل بالقواعد التشغيلية فقط (بدون أي أسرار).
// المبدأ: منصة واحدة = سياسة مستقلة — لا سياسة موحدة للجميع.
// التشغيل: node scripts/gen-platform-policies.mjs
import { mkdirSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "config", "platform-policies")
mkdirSync(root, { recursive: true })

/** القاعدة المشتركة — قيم محايدة، كل منصة تخصص ما تحتاجه */
const base = {
  accessMode: "PUBLIC_ONLY", // SESSION_REQUIRED | SESSION_OPTIONAL | PUBLIC_ONLY
  browserJobs: ["PUBLIC_FETCH"],
  sessionRequiredJobs: [],
  maxConcurrentBrowsers: 1,
  maxJobsPerBrowser: 12,
  minDelayMs: 1500,
  maxDelayMs: 5000,
  maxActionsPerWindow: 40,
  windowMs: 600000,
  cooldownAfterGenerationMs: 120000,
  activeHours: { start: 8, end: 24, tz: "Africa/Cairo" },
  retryPolicy: { maxAttempts: 3, backoffBaseMs: 60000 },
  sessionHealthIntervalMs: 300000,
  failureBackoffMs: 900000,
  maxJobsPerGeneration: 10,
  generationCadenceMs: 900000, // أدنى فاصل بين generations لنفس المنصة — ضد dispatch storm
  notes: "",
}

const policies = {
  // ─── فيسبوك: الجلسة موجودة (READY) — جروبات + رادار + مكتبة إعلانات ───
  FACEBOOK: {
    ...base,
    accessMode: "SESSION_OPTIONAL",
    browserJobs: ["GROUPS_SCAN", "RADAR_SCAN", "PUBLIC_FETCH", "ADS_LIBRARY"],
    sessionRequiredJobs: ["GROUPS_SCAN", "RADAR_SCAN"],
    maxConcurrentBrowsers: 2, // سعة: Browser-FB-01 + Browser-FB-02 عند الضغط
    maxJobsPerBrowser: 10,
    minDelayMs: 2000,
    maxDelayMs: 7000,
    maxActionsPerWindow: 30,
    windowMs: 600000,
    cooldownAfterGenerationMs: 180000,
    failureBackoffMs: 1200000,
    maxJobsPerGeneration: 8,
    notes: "فيسبوك: التصفح عبر mbasic للمحتوى العام والمسجَّل؛ أي checkpoint/حظر → BACKOFF فوري بلا إعادة محاولة متلاحقة",
  },
  // ─── إنستغرام: عامة فقط حاليًا — بروفايلات ومنشورات عامة ───
  INSTAGRAM: {
    ...base,
    accessMode: "SESSION_OPTIONAL",
    browserJobs: ["PUBLIC_FETCH", "GROUPS_SCAN"],
    sessionRequiredJobs: ["GROUPS_SCAN"],
    maxConcurrentBrowsers: 1,
    minDelayMs: 2500,
    maxDelayMs: 7000,
    maxActionsPerWindow: 25,
    cooldownAfterGenerationMs: 240000,
    failureBackoffMs: 1800000,
    notes: "إنستغرام: تسامح منخفض جدًا — منشورات عامة فقط؛ جدار دخول → NEEDS_SESSION وكمّل",
  },
  // ─── لينكدإن: صارم — عامة فقط + بحث وظائف/شركات ───
  LINKEDIN: {
    ...base,
    accessMode: "SESSION_OPTIONAL",
    browserJobs: ["PUBLIC_FETCH"],
    sessionRequiredJobs: [],
    maxConcurrentBrowsers: 1,
    minDelayMs: 4000,
    maxDelayMs: 9000,
    maxActionsPerWindow: 15,
    windowMs: 900000,
    cooldownAfterGenerationMs: 600000,
    failureBackoffMs: 3600000,
    maxJobsPerGeneration: 5,
    notes: "لينكدإن: authwall صارم — الجلب العام فقط، أي authwall → NEEDS_SESSION بلا محاولة تجاوز",
  },
  // ─── X: عامة — Nitter/RSS بدائل، متصفح للمحتوى العام المباشر ───
  X: {
    ...base,
    accessMode: "SESSION_OPTIONAL",
    browserJobs: ["PUBLIC_FETCH"],
    sessionRequiredJobs: [],
    minDelayMs: 3000,
    maxDelayMs: 8000,
    maxActionsPerWindow: 20,
    cooldownAfterGenerationMs: 300000,
    notes: "X: صفحات عامة فقط؛ جدار تسجيل الدخول → NEEDS_SESSION",
  },
  // ─── تيك توك: عامة ───
  TIKTOK: {
    ...base,
    accessMode: "SESSION_OPTIONAL",
    browserJobs: ["PUBLIC_FETCH"],
    sessionRequiredJobs: [],
    minDelayMs: 2500,
    maxDelayMs: 6000,
    maxActionsPerWindow: 25,
    cooldownAfterGenerationMs: 240000,
    notes: "تيك توك: بروفايلات وفيديوهات عامة",
  },
  // ─── ريديت: متساهلة — سرديات عامة + بحث ───
  REDDIT: {
    ...base,
    accessMode: "PUBLIC_ONLY",
    browserJobs: ["PUBLIC_FETCH"],
    maxConcurrentBrowsers: 1,
    minDelayMs: 1500,
    maxDelayMs: 4000,
    maxActionsPerWindow: 50,
    cooldownAfterGenerationMs: 60000,
    notes: "ريديت: المحتوى العام متساهل — سعة أعلى",
  },
  // ─── تليجرام: قنوات عامة عبر web preview ───
  TELEGRAM: {
    ...base,
    accessMode: "PUBLIC_ONLY",
    browserJobs: ["PUBLIC_FETCH"],
    minDelayMs: 1500,
    maxDelayMs: 4000,
    maxActionsPerWindow: 50,
    cooldownAfterGenerationMs: 60000,
    notes: "تليجرام: قنوات عامة t.me/s/ فقط",
  },
  // ─── يوتيوب: عامة ───
  YOUTUBE: {
    ...base,
    accessMode: "PUBLIC_ONLY",
    browserJobs: ["PUBLIC_FETCH"],
    minDelayMs: 2000,
    maxDelayMs: 5000,
    maxActionsPerWindow: 30,
    cooldownAfterGenerationMs: 120000,
    notes: "يوتيوب: قنوات وأوصاف فيديو عامة",
  },
  // ─── ديسكورد: عامة جدًا محدود ───
  DISCORD: {
    ...base,
    accessMode: "PUBLIC_ONLY",
    browserJobs: ["PUBLIC_FETCH"],
    minDelayMs: 2000,
    maxDelayMs: 5000,
    maxActionsPerWindow: 20,
    cooldownAfterGenerationMs: 300000,
    notes: "ديسكورد: صفحات invite/سيرفرات عامة فقط",
  },
  // ─── واتساب: مراسلة وليست متصفحًا — بلا جوبات متصفح ───
  WHATSAPP: {
    ...base,
    accessMode: "SESSION_REQUIRED",
    browserJobs: [], // المراسلة عبر worker المخصص — وليست عبر browser runtime
    sessionRequiredJobs: [],
    maxConcurrentBrowsers: 0,
    notes: "واتساب: قناة مراسلة (worker) — ليست نطاق browser runtime؛ الجلسة تُدار خارج هذا الملف",
  },
}

for (const [platform, policy] of Object.entries(policies)) {
  const out = { platform, ...policy }
  writeFileSync(join(root, `${platform.toLowerCase()}.json`), JSON.stringify(out, null, 2) + "\n")
  console.log(`✓ ${platform}: jobs=[${policy.browserJobs.join(",") || "—"}] browsers=${policy.maxConcurrentBrowsers}`)
}
console.log(`\nتم توليد ${Object.keys(policies).length} ملفات سياسة في ${root}`)
