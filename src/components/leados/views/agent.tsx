"use client";
// LeadOS — Agent Console: كونسول الأيجنت الداخلي بذاكرة البحث والترسانة
// هدف واحد → ذاكرة أولاً (سرش للسرش) → صيد من كل المنصات → خطوات موثقة → ليدز في CRM
import { useState, useEffect, useRef } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  Brain, Sparkles, Play, RefreshCw, Database, Zap, CheckCircle2,
  XCircle, SkipForward, MemoryStick, Lightbulb, Wrench, Globe, MapPin,
} from "lucide-react"

interface StepTrace {
  idx: number
  tool: string
  note: string
  status: string
  durationMs: number
  data?: unknown
}

interface RunRow {
  id: string
  objective: string
  status: string
  summary: string | null
  leadsCreated: number
  itemsScanned: number
  memoryHits: number
  reusedMemory: boolean
  durationMs: number
  createdAt: string
  steps: Array<{ idx: number; tool: string; note: string; status: string; durationMs: number; output: unknown }>
}

interface MemoryRow {
  id: string
  query: string
  platform: string
  qualityScore: number
  leadCount: number
  bestScore: number
  hitCount: number
  lastUsedAt: string
  bestResults: Array<{ title: string; url: string }>
}

interface InsightRow {
  id: string
  kind: string
  pattern: string
  note: string
  weight: number
}

interface ToolRow {
  name: string
  description: string
  ready: boolean
  needs: string[]
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  memory_search: <Brain className="h-3.5 w-3.5" />,
  memory_reuse: <MemoryStick className="h-3.5 w-3.5" />,
  plan: <Lightbulb className="h-3.5 w-3.5" />,
  lead_hunt: <Zap className="h-3.5 w-3.5" />,
  crawl_page: <Globe className="h-3.5 w-3.5" />,
  maps_places: <MapPin className="h-3.5 w-3.5" />,
  memory_save: <Database className="h-3.5 w-3.5" />,
  harvest_summary: <Wrench className="h-3.5 w-3.5" />,
}

const PRESETS = [
  "عيادات أسنان في التجمع الخامس محتاجة نظام حجز",
  "مطاعم وكافيهات في المعادي محتاجة كاشير POS",
  "مكاتب عقارية في الشيخ زايد محتاجة CRM",
  "متاجر انستجرام مصرية بتبيع اونلاين محتاجة متجر إلكتروني",
  "جيمات في مدينة نصر محتاجة نظام اشتراكات",
]

const STEP_STATUS = (s: string) =>
  s === "OK"
    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : s === "SKIPPED"
      ? <SkipForward className="h-4 w-4 text-amber-500" />
      : <XCircle className="h-4 w-4 text-rose-500" />

export function AgentView({ onOpenLead }: { onOpenLead?: (id: string) => void }) {
  const [objective, setObjective] = useState("")
  const [forceFresh, setForceFresh] = useState(false)
  const [running, setRunning] = useState(false)
  const [activeRun, setActiveRun] = useState<RunRow | null>(null)
  const { toast } = useToast()
  const stepsRef = useRef<HTMLDivElement>(null)

  const { data, loading, refresh } = useApi<{
    runs: RunRow[]; insights: InsightRow[]; tools: ToolRow[]
  }>("/api/agent/runs")
  const mem = useApi<{ topQueries: MemoryRow[]; memorySize: number }>("/api/agent/memory")

  // تحديث دوري أثناء التشغيل
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => { refresh(); mem.refresh() }, 4000)
    return () => clearInterval(t)
  }, [running])

  const run = async () => {
    if (objective.trim().length < 5) {
      toast({ title: "اكتب هدفًا واضحًا للأيجنت أولًا" })
      return
    }
    setRunning(true)
    try {
      const res = await apiSend<{ runId: string; summary: string; leadsCreated: number; reusedMemory: boolean }>("/api/agent/run", "POST", {
        objective: objective.trim(),
        forceFresh,
      })
      toast({
        title: res.reusedMemory ? "🧠 رد من الذاكرة — صفر بحث ويب!" : `🎯 صيد جديد: ${res.leadsCreated} ليد`,
        description: res.summary,
      })
      refresh()
      mem.refresh()
    } catch (err) {
      toast({ title: "فشل التشغيل", description: err instanceof Error ? err.message : "خطأ غير معروف" })
    } finally {
      setRunning(false)
    }
  }

  const runs = data?.runs ?? []
  const latest = activeRun ?? runs[0]
  const insights = data?.insights ?? []
  const tools = data?.tools ?? []
  const memoryQueries = mem.data?.topQueries ?? []
  const readyTools = tools.filter((t) => t.ready).length

  return (
    <div className="space-y-4">
      {/* شريط الحالة */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> {readyTools}/{tools.length} أدوات جاهزة</Badge>
        <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> {mem.data?.memorySize ?? 0} استعلام في الذاكرة</Badge>
        <Badge variant="outline" className="gap-1"><Lightbulb className="h-3 w-3" /> {insights.length} استنتاج متعلَّم</Badge>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { refresh(); mem.refresh() }}>
          <RefreshCw className="h-3 w-3" /> تحديث
        </Button>
      </div>

      {/* صندوق الهدف */}
      <Card className="border-primary/30">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4 text-primary" />
            اكتب هدف الأيجنت — هو يفحص ذاكرته الأول، ولو مش لاقي يصطاد من كل المنصات
          </div>
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="مثال: عيادات أسنان في التجمع الخامس محتاجة نظام حجز..."
            className="min-h-20 resize-none"
            maxLength={300}
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setObjective(p)}
                className="text-[11px] px-2 py-1 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >{p}</button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={forceFresh} onChange={(e) => setForceFresh(e.target.checked)} className="accent-primary" />
              تجاهل الذاكرة وصيد جديد بالقوة
            </label>
            <Button onClick={run} disabled={running || objective.trim().length < 5} className="gap-2">
              {running ? <><RefreshCw className="h-4 w-4 animate-spin" /> الأيجنت شغّال...</> : <><Play className="h-4 w-4" /> شغّل الأيجنت</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* خطوات آخر تشغيل */}
        <div className="lg:col-span-3 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> آخر تشغيل — خطوات الأيجنت
          </h3>
          {loading && !latest ? (
            <LoadingBlock label="جارٍ تحميل سجل الأيجنت..." />
          ) : !latest ? (
            <EmptyState icon={<Brain className="h-8 w-8 opacity-40" />} title="الأيجنت لسه ما اشتغلش" hint="اكتب هدف فوق وشغّله — كل خطوة هتتسجل هنا بالتفصيل" />
          ) : (
            <div ref={stepsRef} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="font-medium text-foreground">«{latest.objective.slice(0, 60)}»</span>
                <span>{latest.summary}</span>
              </div>
              {(latest.steps ?? []).map((s) => (
                <Card key={s.idx} className="border-border/50">
                  <CardContent className="py-2.5 px-3 flex items-start gap-2.5">
                    <span className="mt-0.5">{STEP_STATUS(s.status)}</span>
                    <span className="mt-0.5 text-primary">{STEP_ICONS[s.tool] ?? <Wrench className="h-3.5 w-3.5" />}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium">{s.tool}</span>
                        <span className="text-[10px] text-muted-foreground">{s.durationMs}ms</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.note}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* سجل التشغيلات */}
          <h3 className="text-sm font-medium pt-2 flex items-center gap-2"><Play className="h-4 w-4 text-primary" /> سجل التشغيلات</h3>
          <div className="space-y-1.5">
            {runs.slice(0, 8).map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRun(r)}
                className={`w-full text-right px-3 py-2 rounded-lg border text-xs transition-colors ${r.id === latest?.id ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{r.objective.slice(0, 55)}</span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    {r.reusedMemory && <Badge variant="secondary" className="text-[9px] px-1 py-0">ذاكرة</Badge>}
                    <span className="text-emerald-500 font-medium">+{r.leadsCreated}</span>
                    <span className="text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* الذاكرة والأدوات */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> ذاكرة البحث — أفضل الاستعلامات
          </h3>
          {memoryQueries.length === 0 ? (
            <EmptyState icon={<Database className="h-7 w-7 opacity-40" />} title="الذاكرة فاضية" hint="أول تشغيل للأيجنت هيبدأ يملأها" />
          ) : (
            <div className="space-y-1.5">
              {memoryQueries.map((m) => (
                <Card key={m.id} className="border-border/50">
                  <CardContent className="py-2 px-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{m.query.slice(0, 45)}</span>
                      <Badge variant={m.qualityScore >= 60 ? "default" : m.qualityScore >= 30 ? "secondary" : "outline"} className="text-[9px] shrink-0">
                        جودة {m.qualityScore}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{m.platform}</span>
                      <span className="text-emerald-500">{m.leadCount} ليد</span>
                      <span>أفضل {m.bestScore}</span>
                      <span>استُخدم {m.hitCount}×</span>
                      <span>{timeAgo(m.lastUsedAt)}</span>
                    </div>
                    {(m.bestResults ?? []).slice(0, 2).map((b, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground truncate">• {b.title?.slice(0, 50)}</p>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <h3 className="text-sm font-medium flex items-center gap-2 pt-1">
            <Lightbulb className="h-4 w-4 text-primary" /> استنتاجات متعلَّمة
          </h3>
          {insights.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا استنتاجات بعد — الأيجنت يتعلم من كل تشغيل</p>
          ) : (
            <div className="space-y-1.5">
              {insights.map((i) => (
                <div key={i.id} className="text-xs px-3 py-2 rounded-lg border border-border/50 flex items-start gap-2">
                  <Badge variant="outline" className="text-[9px] px-1 shrink-0">{i.kind}</Badge>
                  <span className="text-muted-foreground">{i.note}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">×{i.weight}</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-medium flex items-center gap-2 pt-1">
            <Wrench className="h-4 w-4 text-primary" /> الترسانة ({readyTools}/{tools.length})
          </h3>
          <div className="space-y-1">
            {tools.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border border-border/50">
                <span className="font-mono">{t.name}</span>
                {t.ready
                  ? <Badge variant="default" className="text-[9px] px-1">جاهزة</Badge>
                  : <Badge variant="outline" className="text-[9px] px-1 text-amber-500">تحتاج {t.needs.join("+")}</Badge>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
