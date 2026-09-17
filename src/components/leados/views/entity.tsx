"use client";
// LeadOS — الكيان المستقل: كيان AI بقرار ذاتي كامل (يخطط/ينفذ/يتعلم/يتطور على هدفك)
import { useEffect, useRef, useState } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  BrainCircuit, Play, Square, Lightbulb, Radar, Database, RefreshCw,
  TrendingUp, Sparkles, CheckCircle2, XCircle, MinusCircle, Eye,
} from "lucide-react"

interface EntityStep {
  id: string; idx: number; tool: string; status: string
  note: string | null; durationMs: number; createdAt: string
  input?: { thought?: string; args?: Record<string, unknown>; raw?: string } | null
  output?: { note?: string; error?: string; skipped?: string; data?: unknown } | null
}
interface EntityRun {
  id: string; objective: string; status: string; progress: number
  leadsCreated: number; itemsScanned: number; summary: string | null
  strategy?: string[] | null; errorMessage?: string | null
  durationMs: number; createdAt: string
}
interface EntityData {
  active: boolean
  activeRunId: string | null
  run: EntityRun | null
  steps: EntityStep[]
  insights: Array<{ kind: string; pattern: string; note: string; weight: number; at: string }>
  growth: { runs: number; totalLeads: number; memories: number }
}

const PRESETS = [
  "جيمات التجمع الخامس محتاجة نظام حجز أونلاين",
  "عيادات أسنان في المعادي بدور حلول تسويق رقمي",
  "مطاعم جديدة افتتحت في الشيخ زايد آخر شهر",
  "صيدليات مصر الجديدة عايزة برنامج كاشير",
]

const STATUS_META: Record<string, { label: string; cls: string }> = {
  RUNNING: { label: "شغال الآن", cls: "border-emerald-500/40 text-emerald-300" },
  SUCCESS: { label: "اكتمل ذاتيًا", cls: "border-sky-500/40 text-sky-300" },
  STOPPED: { label: "توقف يدوي", cls: "border-amber-500/40 text-amber-300" },
  FAILED: { label: "فشل", cls: "border-red-500/40 text-red-300" },
}

const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  OK: CheckCircle2, FAILED: XCircle, SKIPPED: MinusCircle,
}

const KIND_LABELS: Record<string, string> = {
  query_pattern: "نمط استعلام", platform_signal: "إشارة منصة",
  positive: "إيجابي", negative: "سلبي", run_outcome: "خلاصة تشغيل", contact_harvest: "حصاد تواصل",
}

export function EntityView() {
  const { data, loading, refresh } = useApi<EntityData>("/api/agent/entity")
  const [goal, setGoal] = useState("")
  const [maxMinutes, setMaxMinutes] = useState(15)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const { toast } = useToast()
  const feedRef = useRef<HTMLDivElement>(null)

  const active = data?.active ?? false
  const run = data?.run ?? null
  const runningNow = active && run?.status === "RUNNING"

  // بث حي كل 2.5ث أثناء التشغيل + تحديث يدوي بعده
  useEffect(() => {
    if (!active) return
    const t = setInterval(refresh, 2500)
    return () => clearInterval(t)
  }, [active, refresh])

  // متابعة تلقائية حتى بعد الختام لمدة قصيرة (جلب الخلاصة النهائية)
  useEffect(() => {
    if (active || !data?.run || data.run.status !== "RUNNING") return
    const t = setTimeout(refresh, 3000)
    return () => clearTimeout(t)
  }, [active, data?.run?.status, refresh])

  useEffect(() => {
    if (feedRef.current && runningNow) feedRef.current.scrollTop = 0
  }, [data?.steps?.length, runningNow])

  const launch = async () => {
    if (goal.trim().length < 6) {
      toast({ title: "اكتب هدفًا واضحًا للكيان أولًا" })
      return
    }
    setStarting(true)
    try {
      await apiSend("/api/agent/entity", "POST", { goal: goal.trim(), max_minutes: maxMinutes })
      toast({ title: "🧠 الكيان استيقظ — هيقرر بنفسه ويشتغل على هدفك", description: "تابع بث خطواته الحية تحت" })
      refresh()
    } catch (e) {
      toast({ title: "فشل البدء", description: e instanceof Error ? e.message : "خطأ غير معروف", variant: "destructive" })
    } finally { setStarting(false) }
  }

  const stop = async () => {
    setStopping(true)
    try {
      await apiSend("/api/agent/entity", "DELETE")
      toast({ title: "إشارة الإيقاف وصلت — هيختم بخلاصة ويحفظ دروسه" })
      refresh()
    } catch (e) {
      toast({ title: "تعذر الإيقاف", description: e instanceof Error ? e.message : "خطأ", variant: "destructive" })
    } finally { setStopping(false) }
  }

  if (loading && !data) return <LoadingBlock />
  if (!data) return null

  const steps = [...(data.steps ?? [])].reverse() // الأحدث أولًا
  const growth = data.growth
  const statusMeta = run ? (STATUS_META[run.status] ?? STATUS_META.RUNNING) : null

  return (
    <div className="space-y-4">
      {/* شريط النمو */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="gap-1 border-violet-500/40 text-violet-300">
          <BrainCircuit className="h-3 w-3" /> {growth.runs} حياة سابقة
        </Badge>
        <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" /> {growth.totalLeads} ليد عبر تاريخه كله</Badge>
        <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> {growth.memories} ذكرى دلالية</Badge>
        <Badge variant="outline" className="gap-1"><Lightbulb className="h-3 w-3" /> {data.insights.length} درس متراكم</Badge>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={refresh}>
          <RefreshCw className="h-3 w-3" /> تحديث
        </Button>
      </div>

      {/* صندوق الهدف */}
      {!runningNow && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuit className="h-4 w-4 text-violet-300" />
              أعطِ الكيان هدفًا — هو يقرر بنفسه إيمتى يسرش وينفذ ويتعلم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="مثال: دوّر على كل الحلقات المحتملة لجيمات الشيخ زايد اللي محتاجة نظام حجز — استنفد كل الزوايا وسجل كل ليد يقدر يتواصل معاه..."
              className="min-h-20 resize-none"
              maxLength={300}
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setGoal(p)}
                  className="text-[11px] px-2 py-1 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                  {p}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                ميزانية الوقت:
                <select value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))}
                  className="bg-secondary rounded px-2 py-1 text-foreground">
                  <option value={8}>8 دقائق</option>
                  <option value={15}>15 دقيقة</option>
                  <option value={22}>22 دقيقة</option>
                  <option value={35}>35 دقيقة</option>
                </select>
              </label>
              <Button onClick={launch} disabled={starting || goal.trim().length < 6} className="gap-2">
                {starting ? <><RefreshCw className="h-4 w-4 animate-spin" /> بيستيقظ...</> : <><Play className="h-4 w-4" /> أيقظ الكيان</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* التشغيل الحالي/الأخير */}
      {run && (
        <Card className={runningNow ? "border-emerald-500/30" : "border-border/70"}>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Radar className={`h-4 w-4 ${runningNow ? "text-emerald-300 animate-pulse" : "text-muted-foreground"}`} />
              <span className="flex-1 truncate text-sm">{run.objective}</span>
              <Badge variant="outline" className={statusMeta?.cls}>{statusMeta?.label}</Badge>
              {runningNow && (
                <Button variant="destructive" size="sm" className="h-7 gap-1" onClick={stop} disabled={stopping}>
                  <Square className="h-3 w-3" /> {stopping ? "بيوقف..." : "إيقاف"}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-secondary/60 p-2">
                <div className="text-lg font-bold">{run.leadsCreated}</div>
                <div className="text-[10px] text-muted-foreground">ليد جديد</div>
              </div>
              <div className="rounded-lg bg-secondary/60 p-2">
                <div className="text-lg font-bold">{run.itemsScanned}</div>
                <div className="text-[10px] text-muted-foreground">عنصر ممسوح</div>
              </div>
              <div className="rounded-lg bg-secondary/60 p-2">
                <div className="text-lg font-bold">{steps.filter((s) => s.tool !== "decision" && s.tool !== "finish").length}</div>
                <div className="text-[10px] text-muted-foreground">إجراءات</div>
              </div>
              <div className="rounded-lg bg-secondary/60 p-2">
                <div className="text-lg font-bold">{run.progress}%</div>
                <div className="text-[10px] text-muted-foreground">تقدم ذاتي</div>
              </div>
            </div>
            {runningNow && (
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-emerald-400/70 transition-all duration-700" style={{ width: `${run.progress}%` }} />
              </div>
            )}
            {run.strategy && run.strategy.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1 font-medium text-foreground/80"><Sparkles className="h-3 w-3 text-amber-300" /> استراتيجيته الآن:</div>
                {run.strategy.slice(0, 2).map((s, i) => <div key={i} className="ps-4">• {s}</div>)}
              </div>
            )}
            {run.summary && !runningNow && (
              <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 text-sm leading-6 whitespace-pre-wrap">{run.summary}</div>
            )}
            {run.errorMessage && <div className="text-xs text-red-300">خطأ: {run.errorMessage}</div>}
          </CardContent>
        </Card>
      )}

      {/* بث الخطوات الحية */}
      {steps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-muted-foreground" /> بث تفكيره وأفعاله
              {runningNow && <span className="text-[10px] text-emerald-300 animate-pulse">● حي</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={feedRef} className="max-h-96 overflow-y-auto space-y-2 pe-1">
              {steps.map((s) => {
                const Icon = STEP_ICON[s.status] ?? MinusCircle
                const thought = s.input?.thought
                const outNote = s.output?.note ?? s.note ?? ""
                return (
                  <div key={s.id} className="rounded-lg border border-border/50 bg-secondary/30 p-2.5">
                    <div className="flex items-start gap-2">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${s.status === "OK" ? "text-emerald-400" : s.status === "FAILED" ? "text-red-400" : "text-amber-400"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-violet-300">{s.tool}</code>
                          {thought && <span className="truncate text-muted-foreground" title={thought}>💭 {thought}</span>}
                          <span className="ms-auto shrink-0 text-[10px] text-muted-foreground">{s.durationMs}ms · {timeAgo(s.createdAt)}</span>
                        </div>
                        {outNote && <div className="mt-1 text-xs leading-5 text-foreground/80">{outNote}</div>}
                        {s.output?.skipped && <div className="mt-0.5 text-[10px] text-amber-300">اتخطى: {s.output.skipped === "duplicate" ? "إجراء مكرر" : "نفدت الميزانية"}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* الدروس المتراكمة */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-amber-300" /> ما تعلمه الكيان عبر حياته ({data.insights.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.insights.length === 0 ? (
            <EmptyState icon={<Lightbulb className="h-8 w-8 text-amber-300/60" />} title="لسه مفيش دروس" hint="أول تشغيلة هيبدأ الكيان يجمع خبرته ويسجل دروسه هنا — ودروس بتتراكم وتأثر على كل تشغيلاته الجاية" />
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 pe-1">
              {data.insights.map((i, idx) => (
                <div key={idx} className="rounded-lg border border-border/50 p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{KIND_LABELS[i.kind] ?? i.kind}</Badge>
                    <span className="font-medium">{i.pattern}</span>
                    <span className="ms-auto text-[10px] text-amber-300">×{i.weight}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground leading-5">{i.note}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
