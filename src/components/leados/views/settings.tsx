"use client";
// LeadOS — Settings (doc §48.11)
import { useState } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, type Me } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Bot, KeyRound, Globe, Cloud, ServerCog, Users2, Copy, Building2 } from "lucide-react"
import { USER_ROLE_LABELS } from "@/lib/constants"

interface SettingsData {
  status: {
    nvidia: boolean; hasKey: boolean
    models: { fast: string; main: string; reason: string }
    tasks?: Record<string, { model: string; chain: string[] }>
    taskLabels?: Record<string, string>
    catalog?: Array<{ id: string; role: string; kind: string; latency: string; tasks: string[] }>
    note: string
  }
  googleMapsKey: boolean
  stats: {
    totalRuns: number
    totalTokens: number
    byType: Array<{ type: string; count: number; avgLatency: number }>
    recent: Array<{ id: string; type: string; provider: string; model: string; latencyMs: number | null; totalTokens: number | null; createdAt: string; success: boolean }>
  }
}

export function SettingsView({ me }: { me: Me }) {
  const { data, loading, refresh } = useApi<SettingsData>("/api/settings/ai")
  const { toast } = useToast()
  const [testPrompt, setTestPrompt] = useState("اختبر الاتصال: قل جاهز")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiSend<{ ok: boolean; provider: string; model: string; latencyMs: number; response: string }>("/api/settings/ai", "POST", { prompt: testPrompt })
      setTestResult(`✓ ${res.provider}/${res.model} — ${res.latencyMs}ms — الرد: ${res.response}`)
      refresh()
    } catch (e) {
      setTestResult(`✗ ${e instanceof Error ? e.message : "فشل الاتصال"}`)
    } finally { setTesting(false) }
  }

  const copyCron = () => {
    navigator.clipboard.writeText(`${window.location.origin}/api/cron/tick?max=5`).then(() => {
      toast({ title: "تم نسخ رابط الـCron — أضفه في cron-job.org" })
    }).catch(() => toast({ title: "تعذر النسخ", variant: "destructive" }))
  }

  if (loading && !data) return <LoadingBlock />
  if (!data) return null

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* AI Providers */}
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-violet-300" /> محرك الذكاء الاصطناعي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={data.status.nvidia ? "border-emerald-500/40 text-emerald-300" : "border-border text-muted-foreground"}>
              <KeyRound className="me-1 h-3 w-3" /> NVIDIA NIM: {data.status.nvidia ? "مفعّل" : "غير مضبوط"}
            </Badge>
            <Badge variant="outline" className="border-violet-500/40 text-violet-300">
              راوتر مهام: {data.status.tasks ? Object.keys(data.status.tasks).length : 3} مهمة · كتالوج: {data.status.catalog?.length ?? 0} موديل حي
            </Badge>
            <Badge variant="outline" className={data.googleMapsKey ? "border-emerald-500/40 text-emerald-300" : "border-border text-muted-foreground"}>
              <Globe className="me-1 h-3 w-3" /> Google Places: {data.googleMapsKey ? "مفعّل" : "غير مضبوط (اختياري)"}
            </Badge>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            محرك الذكاء الاصطناعي الوحيد: <code dir="ltr" className="rounded bg-secondary px-1 font-mono text-[10px]">NVIDIA NIM</code> (مودلات مجانية)
            بمفتاح <code dir="ltr" className="rounded bg-secondary px-1 font-mono text-[10px]">NVIDIA_API_KEY</code> في متغيرات البيئة
            (Vercel → Settings → Environment Variables). كل مهمة بتروح لموديلها المناسب تلقائيًا من الكتالوج الحي الممسوح من الـAPI، ولو مودل وقع بيتحول للبديل تلقائيًا.
            بدون مفتاح، النظام يستخدم المحرك الاستدلالي للكلمات المفتاحية.
          </p>
          {data.status.tasks && data.status.taskLabels && (
            <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
              <p className="mb-1.5 text-[11px] font-bold text-violet-300">جدول التوجيه: مهمة ← موديل (مع بدائل تلقائية)</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {Object.entries(data.status.tasks).map(([task, info]) => (
                  <div key={task} className="flex items-center gap-1.5 rounded bg-secondary/40 px-2 py-1 text-[10px]">
                    <span className="shrink-0 font-bold">{data.status.taskLabels?.[task] ?? task}</span>
                    <span dir="ltr" className="truncate font-mono text-muted-foreground" title={info.chain.join(", ")}>
                      {info.model.split("/").pop()}{info.chain.length > 1 ? ` +${info.chain.length - 1}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Input value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} placeholder="اكتب نص اختبار..." />
            <Button onClick={runTest} disabled={testing}>{testing ? "جارٍ..." : "اختبار"}</Button>
          </div>
          {testResult && (
            <p className={`rounded-lg border p-2.5 text-xs ${testResult.startsWith("✓") ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-rose-500/30 bg-rose-500/5 text-rose-300"}`}>
              {testResult}
            </p>
          )}
          {data.stats.recent.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs font-bold">آخر عمليات الذكاء الاصطناعي ({data.stats.totalRuns}) — {data.stats.totalTokens.toLocaleString("ar-EG")} token</p>
              {data.stats.recent.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">{r.type}</Badge>
                  <span dir="ltr" className="font-mono">{r.provider}/{r.model}</span>
                  {r.latencyMs && <span>{r.latencyMs}ms</span>}
                  {r.totalTokens && <span>{r.totalTokens} tok</span>}
                  <span className="ms-auto">{timeAgo(r.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment / Cron */}
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-4 w-4 text-primary" /> النشر والتشغيل 24/7</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-6 text-muted-foreground">
            النظام يعمل الآن على استضافة مجانية: التطبيق على Vercel + قاعدة بيانات Neon PostgreSQL + cron خارجي يضرب نقطة الـtick كل 5 دقائق
            ليحاكي الـWorkers. اربط cron-job.org بالرابط التالي:
          </p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg border border-border bg-secondary/50 px-3 py-2 font-mono text-[11px]">
              {typeof window !== "undefined" ? `${window.location.origin}/api/cron/tick?max=5` : ""}
            </code>
            <Button size="icon" variant="outline" onClick={copyCron} aria-label="نسخ رابط Cron"><Copy className="h-4 w-4" /></Button>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            حماية النقطة: أضف <code dir="ltr" className="font-mono">CRON_SECRET</code> في البيئة ومرره في الهيدر
            <code dir="ltr" className="mx-1 font-mono">x-cron-secret</code> — أو افتح الرابط وأنت مسجل دخولك للاختبار اليدوي.
          </p>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-[11px] leading-6 text-muted-foreground">
            <p className="mb-1 flex items-center gap-1.5 font-bold text-foreground"><ServerCog className="h-3.5 w-3.5" /> خطوات النشر المجاني (الملخص):</p>
            1. Push الكود على GitHub → 2. استيراد المشروع في Vercel → 3. إنشاء قاعدة Neon وربط
            <code dir="ltr" className="mx-1 font-mono">DATABASE_URL</code> → 4. تسجيل cron-job.org كل 5 دقائق على رابط الـtick →
            5. (اختياري) مفتاح Mistral + مفتاح Google Places. التفاصيل الكاملة في README.md داخل المشروع.
          </div>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-sky-300" /> مساحة العمل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center justify-between"><span className="text-muted-foreground">الاسم</span><span className="font-bold">{me.workspace.name}</span></p>
          <p className="flex items-center justify-between"><span className="text-muted-foreground">المعرف</span><code dir="ltr" className="font-mono text-xs">{me.workspace.slug}</code></p>
          <p className="flex items-center justify-between"><span className="text-muted-foreground">دورك</span><span className="font-bold">{USER_ROLE_LABELS[me.user.role] ?? me.user.role}</span></p>
          <p className="flex items-center justify-between"><span className="text-muted-foreground">الأعضاء</span><span className="font-bold">{me.memberCount}</span></p>
        </CardContent>
      </Card>

      {/* Team */}
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Users2 className="h-4 w-4 text-amber-300" /> الفريق والأدوار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-6 text-muted-foreground">
          <p>الأدوار: مالك (كل الصلاحيات) • مدير نظام • مدير • مندوب مبيعات (يدير الـLeads والمهام) • مشاهد (قراءة فقط).</p>
          <p>الصلاحيات مطبقة على مستوى السيرفر لكل نقطة API — والعمليات الحساسة تُسجل في Audit Log مع المستخدم والوقت والتغييرات.</p>
          <p className="rounded-lg border border-border/60 bg-secondary/30 p-2">
            إضافة أعضاء جدد: أنشئ حسابًا لهم من شاشة تسجيل الدخول ثم أضفهم كـWorkspaceMember من قاعدة البيانات —
            في النسخة القادمة ستكون الإدارة كاملة من هذه الشاشة.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
