"use client";
// LeadOS — Browser Control Center (طلب §30 + §31 + §32 + §29 + §38)
// مركز التحكم بالمتصفحات: منصة واحدة = متصفح مخصص — Pools، الجلسات، السياسات الحية،
// Runtime Health، سلسلة الجيلات، ومراقبة Jina. لا أسرار هنا: حالات فقط، لا كوكيز.
import { useEffect, useState } from "react"
import { apiGet, timeAgo, fmtNum, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Monitor, HeartPulse, Globe2, RefreshCw, ShieldCheck, Timer, Radar, Layers } from "lucide-react"

interface PlatformRow {
  platform: string
  accessMode: string
  notes: string
  browsers: { count: number; starting: number; ready: number; busy: number; idle: number; failed: number; recovering: number; lost: number; closed: number; activeCapacity: number; configuredLimit: number; freeSlots: number }
  queue: number
  session: { status: string; version: number; profileId: string; lastValidatedAt: string | null; lastSuccessfulUse: string | null; seededFrom: string | null }
  policyLive: { concurrencyInUse: number; concurrencyLimit: number; actionsInWindow: number; maxActionsPerWindow: number; remainingCapacity: number; windowMs: number; cooldownActive: boolean; cooldownUntil: string | null; activeHours: { start: number; end: number; tz: string } }
  lastBlock: { reason: string; at: string } | null
  lastDispatch: { at: string } | null
}

interface ControlData {
  platforms: PlatformRow[]
  github?: { state: "OPERATIONAL" | "FAILING" | "BLOCKED_EXTERNAL" | "UNKNOWN"; lastRunAt: string | null; conclusion: string | null; url: string | null; message?: string }
  health: {
    activeBrowsers: number; globalActive: number; globalBrowserLimit: number; globalJobLimit: number
    totalUptimeMinutes: number; browserStarts24h: number; unexpectedRestarts24h: number
    sessionRecoveries24h: number; jobsPerBrowserRatio: number; tasksDone24h: number
    lostBrowsersReapedNow: number; jobsRequeuedNow: number; queueWaitOldestMinutes: number
  }
  generations: Array<{ platform: string; generation: number; createdAt: string; detail: Record<string, unknown> }>
  jina: Array<{ day: string; requests: number; success: number; failure: number; timeouts: number; avgLatencyMs: number; lastSuccessAt: string | null; lastError: string | null }>
  events: Array<{ type: string; platform: string; browserId: string | null; generation: number; detail: Record<string, unknown> | null; createdAt: string }>
}

const SESSION_BADGE: Record<string, string> = {
  READY: "border-emerald-500/40 text-emerald-300",
  HEALTHY: "border-emerald-500/40 text-emerald-300",
  DEGRADED: "border-amber-500/40 text-amber-300",
  RECOVERING: "border-amber-500/40 text-amber-300",
  EXPIRED: "border-rose-500/40 text-rose-300",
  FAILED: "border-rose-500/40 text-rose-300",
  NEEDS_SESSION: "border-border text-muted-foreground",
}
const SESSION_LABEL: Record<string, string> = {
  READY: "جاهزة", HEALTHY: "سليمة", DEGRADED: "متدهورة", RECOVERING: "في استعادة",
  EXPIRED: "منتهية", FAILED: "فاشلة", NEEDS_SESSION: "بدون جلسة",
}
const BLOCK_LABEL: Record<string, string> = {
  CAPACITY_LIMIT: "السعة ممتلئة", COOLDOWN: "فترة تهدئة", SESSION_MISSING: "الجلسة ناقصة",
  PLATFORM_PAUSED: "المنصة موقوفة", ACTIVE_HOURS: "خارج ساعات النشاط", POLICY_MISSING: "لا سياسة",
  TASK_NOT_ALLOWED: "مهمة غير مسموحة", GLOBAL_LIMIT: "السعة العامة ممتلئة",
}
const PLATFORM_AR: Record<string, string> = {
  FACEBOOK: "فيسبوك", INSTAGRAM: "إنستجرام", LINKEDIN: "لينكدإن", X: "X", TIKTOK: "تيك توك",
  REDDIT: "ريديت", TELEGRAM: "تليجرام", DISCORD: "ديسكورد", YOUTUBE: "يوتيوب", WHATSAPP: "واتساب",
}
const EVENT_ICON: Record<string, string> = {
  BROWSER_START: "▶", BROWSER_CLOSE: "⏹", HEARTBEAT_LOST: "💔", RECOVER: "♻", SESSION_RESTORE: "📥",
  SESSION_SAVE: "💾", SESSION_HEALTH: "💚", CHECKPOINT: "⏩", RATE_WAIT: "⏳", POLICY_BLOCK: "🛡",
  TASK_DONE: "✅", TASK_FAILED: "❌", DISPATCH: "🔗", PLATFORM_PAUSED: "⏸", STALE_RECOVER: "♻",
}

export function BrowserControlView() {
  const [data, setData] = useState<ControlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const d = await apiGet<ControlData>("/api/browser/control")
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ تحميل")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000) // حي كل 15 ثانية
    return () => clearInterval(t)
  }, [])

  if (loading && !data) return <LoadingBlock label="جارٍ فتح مركز المتصفحات..." />
  if (error) return <EmptyState icon={<Monitor className="h-10 w-10 text-rose-400" />} title="تعذر تحميل مركز المتصفحات" hint={error} />
  if (!data) return <EmptyState icon={<Monitor className="h-10 w-10" />} title="لا بيانات" />

  const h = data.health
  const withBrowsers = data.platforms.filter((p) => p.browsers.count > 0 || p.queue > 0)

  return (
    <div className="space-y-4" dir="rtl">
      {/* ─── GLOBAL (§40) ─── */}
      {/* حالة GitHub Actions runner (§14) — حقيقية فقط: OPERATIONAL/FAILING/BLOCKED_EXTERNAL/UNKNOWN */}
      {data.github && (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${data.github.state === "OPERATIONAL" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : data.github.state === "UNKNOWN" ? "border-border text-muted-foreground" : "border-rose-500/30 bg-rose-500/5 text-rose-300"}`}>
          <span className="font-bold">⚙️ GitHub Actions Runtime:</span>
          <span>{data.github.state === "OPERATIONAL" ? "يعمل" : data.github.state === "FAILING" ? "فاشل (تشغيل فعلي فشل)" : data.github.state === "BLOCKED_EXTERNAL" ? "محجوب خارجيًا (startup_failure — قيد حساب)" : "غير معروف"}</span>
          {data.github.lastRunAt && <span className="text-muted-foreground">آخر تشغيل: {timeAgo(data.github.lastRunAt)} ({data.github.conclusion})</span>}
          {data.github.message && <span className="text-muted-foreground">{data.github.message}</span>}
          {data.github.state === "BLOCKED_EXTERNAL" && <span className="text-amber-300">— سبب خارجي لا يُصلح بالكود: يلزم حل قيد الحساب أو runner ذاتي الاستضافة (docs/DEPLOY-vps.md)</span>}
          {data.github.url && <a href={data.github.url} target="_blank" rel="noreferrer" className="underline">لوج التشغيل</a>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">متصفحات نشطة</div><div className="text-2xl font-bold">{h.activeBrowsers}</div><div className="text-[11px] text-muted-foreground">الحد العام: {h.globalBrowserLimit}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">مهام مكتملة 24س</div><div className="text-2xl font-bold">{fmtNum(h.tasksDone24h)}</div><div className="text-[11px] text-muted-foreground">نسبة مهمة/متصفح: {h.jobsPerBrowserRatio}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إعادة تشغيل غير ضرورية</div><div className={`text-2xl font-bold ${h.unexpectedRestarts24h > 0 ? "text-amber-400" : "text-emerald-400"}`}>{h.unexpectedRestarts24h}</div><div className="text-[11px] text-muted-foreground">الهدف: أقل حد ممكن (§32)</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">استعادات جلسات 24س</div><div className="text-2xl font-bold">{h.sessionRecoveries24h}</div><div className="text-[11px] text-muted-foreground">استمرارية بين الجيلات</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">طابور أقدم مهمة</div><div className={`text-2xl font-bold ${h.queueWaitOldestMinutes > 60 ? "text-amber-400" : ""}`}>{h.queueWaitOldestMinutes}د</div><div className="text-[11px] text-muted-foreground">انتظار في الطابور</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">متصفحات فُقدت الآن</div><div className="text-2xl font-bold">{h.lostBrowsersReapedNow}</div><div className="text-[11px] text-muted-foreground">{h.jobsRequeuedNow > 0 ? `${h.jobsRequeuedNow} مهمة أعيدت للطابور` : "لا انتظار"}</div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Monitor className="h-5 w-5 text-emerald-400" /> مركز التحكم بالمتصفحات — منصة واحدة = متصفح مخصص</h2>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> تحديث</Button>
      </div>

      {/* ─── PER-PLATFORM (§30/§31) ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.platforms.map((p) => {
          const blocked = p.lastBlock?.reason
          return (
            <Card key={p.platform} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe2 className="h-4 w-4 text-emerald-400" />
                    {PLATFORM_AR[p.platform] ?? p.platform}
                    <Badge variant="outline" className="text-[10px]">{p.accessMode === "PUBLIC_ONLY" ? "عامة فقط" : p.accessMode === "SESSION_REQUIRED" ? "تتطلب جلسة" : "جلسة اختيارية"}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={SESSION_BADGE[p.session.status] ?? "border-border"}>{SESSION_LABEL[p.session.status] ?? p.session.status}</Badge>
                    {p.session.version > 0 && <Badge variant="outline" className="text-[10px]">v{p.session.version}</Badge>}
                  </div>
                </div>
                <CardDescription className="text-[11px] leading-relaxed">{p.notes}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-background/50 p-2">
                    <div className="text-[10px] text-muted-foreground">المتصفحات</div>
                    <div className="text-lg font-bold">{p.browsers.count}</div>
                    <div className="text-[10px] text-muted-foreground">حد: {p.browsers.configuredLimit}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-2">
                    <div className="text-[10px] text-muted-foreground">نشطة الآن</div>
                    <div className="text-lg font-bold">{p.browsers.activeCapacity}</div>
                    <div className="text-[10px] text-muted-foreground">{p.browsers.busy > 0 ? `${p.browsers.busy} مشغولة` : p.browsers.idle > 0 ? `${p.browsers.idle} خاملة` : "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-2">
                    <div className="text-[10px] text-muted-foreground">الطابور</div>
                    <div className={`text-lg font-bold ${p.queue > 20 ? "text-amber-400" : ""}`}>{p.queue}</div>
                    <div className="text-[10px] text-muted-foreground">{p.browsers.failed + p.browsers.lost > 0 ? `فاشلة/مفقودة: ${p.browsers.failed + p.browsers.lost}` : "لا أعطال"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-muted-foreground" /> نافذة الإجراءات: <b>{p.policyLive.actionsInWindow}/{p.policyLive.maxActionsPerWindow}</b> — متاح {p.policyLive.remainingCapacity}</div>
                  <div className="flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5 text-muted-foreground" /> ساعات النشاط: <b>{p.policyLive.activeHours.start}-{p.policyLive.activeHours.end}</b> ({p.policyLive.activeHours.tz})</div>
                  <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" /> {p.policyLive.cooldownActive ? <span className="text-amber-400">تهدئة حتى {timeAgo(p.policyLive.cooldownUntil)}</span> : "لا تهدئة نشطة"}</div>
                  <div className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-muted-foreground" /> آخر جيل: {p.lastDispatch ? timeAgo(p.lastDispatch.at) : "لم يبدأ بعد"}</div>
                </div>

                {blocked && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-300">
                    🛡 آخر منع: <b>{BLOCK_LABEL[blocked] ?? blocked}</b> — متصفح جديد لم يبدأ لهذا السبب ({timeAgo(p.lastBlock?.at)})
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ─── سلسلة الجيلات (§37/§40) ─── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Radar className="h-4 w-4 text-emerald-400" /> سلسلة الجيلات (N → N+1)</CardTitle></CardHeader>
          <CardContent>
            {data.generations.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">لا جيلات بعد — أول طابور ممتلئ سيبدأ السلسلة</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {data.generations.slice(0, 8).map((g, i) => {
                  const d = g.detail as { parentRunId?: string; childRunId?: string; nextGeneration?: number; queueDepth?: number; triggerType?: string }
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
                      <span className="font-mono text-emerald-400">{g.platform} g{g.generation}</span>
                      <span>→</span>
                      <span className="font-mono text-sky-300">g{d.nextGeneration ?? g.generation + 1}</span>
                      <Badge variant="outline" className="text-[9px]">{d.triggerType ?? "SELF_DISPATCH"}</Badge>
                      <span className="text-muted-foreground">parent={d.parentRunId?.slice(0, 14)}…</span>
                      <span className="text-muted-foreground">طابور={d.queueDepth ?? 0}</span>
                      <span className="ms-auto text-muted-foreground">{timeAgo(g.createdAt)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Jina (§29) ─── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4 text-emerald-400" /> Jina Reader — قارئ احتياطي مع مراقبة</CardTitle></CardHeader>
          <CardContent>
            {data.jina.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">لا استدعاءات Jina بعد — يُستدعى تلقائيًا عند فشل الجلب المباشر</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {data.jina.slice(0, 7).map((j) => (
                  <div key={j.day} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-1.5">
                    <span className="font-mono">{j.day}</span>
                    <Badge variant="outline" className="text-[10px]">{j.requests} طلب</Badge>
                    <span className="text-emerald-400">✓ {j.success}</span>
                    <span className="text-rose-400">✗ {j.failure}</span>
                    <span className="text-amber-400">⏱ {j.timeouts}</span>
                    <span className="text-muted-foreground">متوسط {j.avgLatencyMs}ms</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── آخر الأحداث (§38) ─── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><HeartPulse className="h-4 w-4 text-emerald-400" /> نبض الأحداث الحي</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-80 space-y-1 overflow-y-auto text-xs" >
            {data.events.map((e, i) => {
              const d = (e.detail ?? {}) as Record<string, unknown>
              const extra = d.summary ?? d.note ?? d.closeReason ?? d.reason ?? (d.jobs ? `${d.jobs} مهام` : "")
              return (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1">
                  <span>{EVENT_ICON[e.type] ?? "•"}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
                  <Badge variant="outline" className="text-[9px]">{PLATFORM_AR[e.platform] ?? e.platform}</Badge>
                  <span className="font-medium">{e.type}</span>
                  {e.browserId && <span className="font-mono text-[10px] text-muted-foreground">{e.browserId}</span>}
                  {typeof extra === "string" && extra && <span className="truncate text-muted-foreground">{extra}</span>}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
