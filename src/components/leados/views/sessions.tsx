"use client";
// LeadOS — Platform Accounts / Sessions Onboarding (SESSIONLESS MODE — طلب §29/§30)
// إضافة جلسة لكل منصة بدون تعديل كود — الكوكي سر: لا يُعرض بعد الحفظ إطلاقًا
// نعرض فقط: Configured / Valid / Expired / Last checked.
import { useCallback, useEffect, useState } from "react"
import { apiSend, timeAgo, LoadingBlock } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { KeySquare, ShieldCheck, Trash2, ClipboardCheck } from "lucide-react"

interface SessionRow {
  platform: string
  state: string
  source: string | null
  configured: boolean
  lastVerifiedAt: string | null
  expiresAt: string | null
  lastError: string | null
  hint: string | null
}

const STATE_BADGE: Record<string, string> = {
  READY: "border-emerald-500/40 text-emerald-300",
  WARMING: "border-sky-500/40 text-sky-300",
  EXPIRED: "border-amber-500/40 text-amber-300",
  NOT_CONFIGURED: "border-border text-muted-foreground",
  NEEDS_SESSION: "border-amber-500/40 text-amber-300",
  BLOCKED: "border-rose-500/40 text-rose-300",
  ERROR: "border-rose-500/40 text-rose-300",
  PAUSED: "border-slate-500/40 text-slate-400",
}
const STATE_LABEL: Record<string, string> = {
  READY: "صالحة", WARMING: "فحص معلق", EXPIRED: "منتهية", NOT_CONFIGURED: "غير مضافة",
  NEEDS_SESSION: "محتاج جلسة", BLOCKED: "محجوبة", ERROR: "خطأ", PAUSED: "موقوفة",
}
const PLATFORMS = [
  { key: "FACEBOOK", label: "فيسبوك", hint: "كوكي جلسة مسجلة (c_user + xs على الأقل)" },
  { key: "INSTAGRAM", label: "إنستجرام", hint: "كوكي sessionid" },
  { key: "LINKEDIN", label: "لينكدإن", hint: "كوكي li_at" },
  { key: "X", label: "X / تويتر", hint: "كوكي auth_token" },
  { key: "TIKTOK", label: "تيك توك", hint: "كوكي sessionid" },
  { key: "DISCORD", label: "ديسكورد", hint: "كوكي token" },
  { key: "TELEGRAM", label: "تليجرام", hint: "جلسة web (اختياري — القنوات العامة شغالة بدونه)" },
  { key: "REDDIT", label: "ريديت", hint: "اختياري — القراءة العامة شغالة بدون جلسة" },
  { key: "YOUTUBE", label: "يوتيوب", hint: "كوكي جلسة مسجلة" },
]

export function SessionsCard() {
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState("FACEBOOK")
  const [cookie, setCookie] = useState("")
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/platforms/sessions")
      const data = await r.json()
      setRows(data.sessions ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (cookie.trim().length < 20) {
      toast({ title: "الصق الكوكي كامل — القيمة قصيرة", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const r = await apiSend<{ state: string; note: string; requeuedJobs: number }>("/api/platforms/sessions", "POST", { platform: selected, cookie })
      toast({ title: `${selected}: ${STATE_LABEL[r.state] ?? r.state} — ${r.note}${r.requeuedJobs ? ` — أُعيد ${r.requeuedJobs} مهمة للطابور` : ""}` })
      setCookie("")
      await load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "فشل الحفظ", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const verify = async (platform: string) => {
    setBusy(true)
    try {
      const r = await apiSend<{ state: string; note: string }>("/api/platforms/sessions", "PATCH", { platform })
      toast({ title: `${platform}: ${STATE_LABEL[r.state] ?? r.state} — ${r.note}` })
      await load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "فشل الفحص", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (platform: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/platforms/sessions?platform=${platform}`, "DELETE")
      toast({ title: `${platform}: تم حذف الجلسة — القدرة رجعت «غير مضافة» بأمان` })
      await load()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "فشل الحذف", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setCookie(text)
      toast({ title: "تم اللصق — القيمة لن تُعرض مرة أخرى بعد الحفظ" })
    } catch {
      toast({ title: "اعتمد على اللصق اليدوي في الحقل" })
    }
  }

  const current = PLATFORMS.find((p) => p.key === selected)

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeySquare className="h-4 w-4 text-sky-300" /> حسابات المنصات / الجلسات
          <Badge variant="outline" className="border-sky-500/40 text-sky-300">اختيارية 100%</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-6 text-muted-foreground">
          النظام يعمل الآن بلا أي جلسات على المسارات العامة. أضف جلسة لأي منصة لتفعيل قدراتها الموثقة تلقائيًا
          (مسح الجروبات، الرادار…) بدون تعديل كود. الكوكي يُخزن مشفرًا (AES-256-GCM) ولا يُعرض أبدًا بعد الحفظ.
        </p>
        {loading && !rows ? <LoadingBlock /> : (
          <div className="space-y-1.5">
            {(rows ?? []).map((r) => (
              <div key={r.platform} className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-2.5 py-1.5">
                <span className="w-20 shrink-0 text-xs font-bold">{PLATFORMS.find((p) => p.key === r.platform)?.label ?? r.platform}</span>
                <Badge variant="outline" className={`text-[10px] ${STATE_BADGE[r.state] ?? ""}`}>
                  {STATE_LABEL[r.state] ?? r.state}{r.source === "env" ? " (env)" : ""}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {r.lastVerifiedAt ? `آخر فحص ${timeAgo(r.lastVerifiedAt)}` : "لم تُفحص"}
                </span>
                {r.configured && (
                  <div className="ms-auto flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" disabled={busy} onClick={() => verify(r.platform)}>
                      <ShieldCheck className="h-3 w-3" /> فحص
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-rose-300" disabled={busy} onClick={() => remove(r.platform)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={paste} type="button">
              <ClipboardCheck className="h-3.5 w-3.5" /> لصق
            </Button>
            <span className="text-[10px] text-muted-foreground">{current?.hint}</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              autoComplete="off"
              dir="ltr"
              className="font-mono text-[11px]"
              placeholder="الصق قيمة الكوكي هنا — لا تُعرض ولا تُخزن كنص صريح"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
            />
            <Button onClick={save} disabled={busy || !cookie.trim()}>{busy ? "جارٍ…" : "حفظ وفحص"}</Button>
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">
            أمان: القيمة تُشفّر قبل التخزين، لا تظهر في السجلات أو الردود أو المتصفح، ويمكن حذفها في أي وقت.
            الفحص آمن: طلب قراءة واحد فقط — لا تسجيل دخول تلقائي ولا تجاوز حماية.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
