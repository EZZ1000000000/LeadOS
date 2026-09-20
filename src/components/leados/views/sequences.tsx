"use client";
// LeadOS — واجهة سلاسل المتابعة (الموجة الجديدة)
// 3 أقسام: سلاسل المتابعة متعددة اللمسات + تجارب A/B على الرسايل + حسابات المنصات (multi-account)
import { useState } from "react"
import { useApi, apiSend, timeAgo, EmptyState, LoadingBlock } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Repeat, Plus, FlaskConical, Smartphone, Trash2, Users } from "lucide-react"

const KIND_LABELS: Record<string, string> = {
  NURTURE: "ليدز جديدة", REACTIVATION: "إعادة تفعيل", ONBOARD: "عملاء جدد",
}
const ACCOUNT_STATUS: Record<string, { label: string; cls: string }> = {
  WARMING: { label: "تدريب", cls: "bg-amber-500/15 text-amber-300" },
  ACTIVE: { label: "نشط", cls: "bg-emerald-500/15 text-emerald-300" },
  COOLDOWN: { label: "استراحة", cls: "bg-sky-500/15 text-sky-300" },
  BLOCKED: { label: "محجوب", cls: "bg-rose-500/15 text-rose-300" },
  DISABLED: { label: "معطل", cls: "bg-slate-500/15 text-slate-400" },
}

interface SeqStep { id: string; order: number; channel: string; template: string; waitHours: number; active: boolean }
interface SequenceRow {
  id: string
  name: string
  description: string | null
  kind: string
  enabled: boolean
  steps: SeqStep[]
  enrollments: Array<{ id: string; status: string }>
}
interface ExperimentRow {
  id: string
  name: string
  status: string
  variants: Array<{ name: string; template: string; sent: number; replied: number; won: number }>
  createdAt: string
}
interface AccountRow {
  id: string
  platform: string
  handle: string
  label: string | null
  status: string
  dailyLimit: number
  sentToday: number
  lastSentAt: string | null
}

// ═══════════ السلاسل ═══════════
function SequencesSection() {
  const { data, loading, refresh } = useApi<{ sequences: SequenceRow[] }>("/api/sequences")
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [kind, setKind] = useState("NURTURE")
  const [steps, setSteps] = useState<Array<{ template: string; waitHours: number }>>([{ template: "", waitHours: 72 }])
  const { toast } = useToast()

  const toggle = async (s: SequenceRow, enabled: boolean) => {
    try {
      await apiSend(`/api/sequences/${s.id}`, "PATCH", { enabled })
      toast({ title: enabled ? `تم تفعيل: ${s.name}` : `تم إيقاف: ${s.name}` })
      refresh()
    } catch (e) { toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" }) }
  }
  const remove = async (s: SequenceRow) => {
    try {
      await apiSend(`/api/sequences/${s.id}`, "DELETE")
      toast({ title: `تم حذف: ${s.name}` })
      refresh()
    } catch (e) { toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" }) }
  }
  const create = async () => {
    if (!name.trim() || !steps.some((s) => s.template.trim())) {
      toast({ title: "اسم + خطوة واحدة بنص مطلوبين" }); return
    }
    setCreating(true)
    try {
      await apiSend("/api/sequences", "POST", { name, kind, steps: steps.map((s) => ({ ...s, channel: "TASK" })) })
      toast({ title: "السلسلة اتعملت ✅" })
      setName(""); setSteps([{ template: "", waitHours: 72 }]); refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" })
    } finally { setCreating(false) }
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><Repeat className="h-4 w-4 text-violet-300" /> سلاسل المتابعة متعددة اللمسات</span>
          <Dialog>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> سلسلة جديدة</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>سلسلة متابعة جديدة</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: متابعة مطاعم" /></div>
                <div className="space-y-1">
                  <Label>النوع</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {steps.map((s, i) => (
                  <div key={i} className="space-y-1 rounded-lg border border-border/60 p-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">اللمسة {i + 1}</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} className="h-7 w-20 text-xs" value={s.waitHours}
                          onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, waitHours: Number(e.target.value) } : x))} />
                        <span className="text-[10px] text-muted-foreground">ساعة انتظار</span>
                      </div>
                    </div>
                    <Textarea className="min-h-16 text-xs" value={s.template}
                      onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, template: e.target.value } : x))}
                      placeholder="نص الرسالة بالعامية — {{contactName}} و {{business}} و {{industry}} بتتستبدل تلقائيًا" />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSteps([...steps, { template: "", waitHours: 72 }])} className="w-full">+ لمسة إضافية</Button>
                <Button className="w-full" onClick={create} disabled={creating}>{creating ? "جارٍ الإنشاء..." : "إنشاء السلسلة"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          سياسة الرد-فقط: كل لمسة بتطلع <b>مهمة بنص جاهز</b> — بتضغط إرسال بنفسك. لو العميل رد، السلسلة توقف لوحدها.
        </p>
        {loading ? <LoadingBlock /> : !data?.sequences.length ? (
          <EmptyState icon={<Repeat className="h-10 w-10" />} title="مفيش سلاسل" hint="السلاسل الافتراضية بتتعمل تلقائيًا أول مرة تفتح الصفحة" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.sequences.map((s) => {
              const active = s.enrollments.filter((e) => e.status === "ACTIVE").length
              const done = s.enrollments.filter((e) => e.status === "COMPLETED").length
              return (
                <Card key={s.id} className="border-border/70">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{s.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{KIND_LABELS[s.kind] ?? s.kind}</Badge>
                          <Badge variant="outline" className="text-[10px]">{s.steps.length} لمسات</Badge>
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><Users className="h-3 w-3" /> {active} نشط / {done} خلص</span>
                        </div>
                      </div>
                      <Switch checked={s.enabled} onCheckedChange={(v) => toggle(s, v)} aria-label="تشغيل/إيقاف" />
                    </div>
                    {s.description && <p className="line-clamp-2 text-[11px] text-muted-foreground">{s.description}</p>}
                    <div className="space-y-1">
                      {s.steps.slice(0, 3).map((st) => (
                        <p key={st.id} className="line-clamp-1 rounded bg-secondary/40 px-2 py-1 text-[10px]">
                          <b className="text-primary">+{st.waitHours}س:</b> {st.template}
                        </p>
                      ))}
                      {s.steps.length > 3 && <p className="text-[10px] text-muted-foreground">+ {s.steps.length - 3} لمسات كمان...</p>}
                    </div>
                    <button onClick={() => remove(s)} className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-destructive">
                      <Trash2 className="h-3 w-3" /> حذف
                    </button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════ تجارب A/B ═══════════
function ExperimentsSection() {
  const { data, loading, refresh } = useApi<{ experiments: ExperimentRow[] }>("/api/experiments")
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [va, setVa] = useState("")
  const [vb, setVb] = useState("")
  const { toast } = useToast()

  const create = async () => {
    try {
      await apiSend("/api/experiments", "POST", { name, variants: [{ name: "صيغة أ", template: va }, { name: "صيغة ب", template: vb }] })
      toast({ title: "التجربة بدأت ✅ — زيزو هيوزّع الإرسالات بين الصيغتين" })
      setOpen(false); setName(""); setVa(""); setVb(""); refresh()
    } catch (e) { toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" }) }
  }
  const record = async (id: string, field: "recordReply" | "recordWon", idx: number) => {
    try { await apiSend(`/api/experiments/${id}`, "PATCH", { [field]: idx }); refresh() }
    catch (e) { toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" }) }
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-emerald-300" /> تجارب A/B على الرسايل</span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> تجربة جديدة</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>تجربة A/B — صيغتين رسالة</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>اسم التجربة</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: افتتاحية قصيرة vs طويلة" /></div>
                <div className="space-y-1"><Label>الصيغة أ</Label><Textarea className="min-h-16 text-xs" value={va} onChange={(e) => setVa(e.target.value)} /></div>
                <div className="space-y-1"><Label>الصيغة ب</Label><Textarea className="min-h-16 text-xs" value={vb} onChange={(e) => setVb(e.target.value)} /></div>
                <Button className="w-full" onClick={create}>بدء التجربة</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingBlock /> : !data?.experiments.length ? (
          <p className="text-xs text-muted-foreground">مفيش تجارب — ابدأ واحدة وقارن نسب الرد بين صيغتين، والفائزة تبقى القالب الافتراضي.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.experiments.map((e) => (
              <Card key={e.id} className="border-border/70">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{e.name}</p>
                    <Badge variant={e.status === "RUNNING" ? "default" : "outline"} className="text-[10px]">{e.status === "RUNNING" ? "جارية" : "خلصت"}</Badge>
                  </div>
                  {e.variants.map((v, i) => (
                    <div key={i} className="rounded-lg border border-border/60 p-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <b>{v.name}</b>
                        <span className="font-mono text-[10px] text-muted-foreground">بعت {v.sent} · رد {v.replied} · قفل {v.won}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{v.template}</p>
                      <div className="mt-1 flex gap-2">
                        <button onClick={() => record(e.id, "recordReply", i)} className="text-[10px] text-primary hover:underline">+ سجل رد</button>
                        <button onClick={() => record(e.id, "recordWon", i)} className="text-[10px] text-emerald-400 hover:underline">+ سجل إغلاق</button>
                        <span className="text-[10px] text-muted-foreground">نسبة الرد: {v.sent ? Math.round((v.replied / v.sent) * 100) : 0}%</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">بدأت {timeAgo(e.createdAt)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════ حسابات المنصات ═══════════
function AccountsSection() {
  const { data, loading, refresh } = useApi<{ accounts: AccountRow[] }>("/api/accounts")
  const [platform, setPlatform] = useState("WHATSAPP")
  const [handle, setHandle] = useState("")
  const [dailyLimit, setDailyLimit] = useState("20")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const add = async () => {
    if (!handle.trim()) { toast({ title: "اكتب معرّف الحساب (رقم/يوزر)" }); return }
    setSaving(true)
    try {
      await apiSend("/api/accounts", "POST", { platform, handle, dailyLimit: Number(dailyLimit) })
      toast({ title: "الحساب اتضاف بحالة تدريب — بعد ما يتعير حوّله لـ نشط" })
      setHandle(""); refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" })
    } finally { setSaving(false) }
  }
  const setStatus = async (a: AccountRow, status: string) => {
    try { await apiSend(`/api/accounts/${a.id}`, "PATCH", { status, resetCounter: status === "ACTIVE" }); refresh() }
    catch (e) { toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" }) }
  }
  const remove = async (a: AccountRow) => {
    try { await apiSend(`/api/accounts/${a.id}`, "DELETE"); toast({ title: "تم الحذف" }); refresh() }
    catch (e) { toast({ title: e instanceof Error ? e.message : "خطأ", variant: "destructive" }) }
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Smartphone className="h-4 w-4 text-primary" /> حسابات المنصات (Multi-Account)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">كل حساب = كوتية يومية مستقلة — زيزو بيوزع الإرسال تلقائيًا على الحسابات النشطة. الحساب الجديد يبدأ <b>تدريب</b> (يدخل جروبات ويتفرج زي الإنسان) وبعدها يبقى <b>نشط</b>.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><Label className="text-xs">المنصة</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{["WHATSAPP", "FACEBOOK", "INSTAGRAM", "TELEGRAM", "LINKEDIN", "X"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">المعرّف</Label>
            <Input className="h-9 w-44" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="+2010xxxxxxx / @user" dir="ltr" />
          </div>
          <div className="space-y-1"><Label className="text-xs">حد/يوم</Label>
            <Input type="number" className="h-9 w-20" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
          </div>
          <Button size="sm" onClick={add} disabled={saving} className="gap-1"><Plus className="h-3.5 w-3.5" /> إضافة</Button>
        </div>
        {loading ? <LoadingBlock /> : !data?.accounts.length ? (
          <p className="text-xs text-muted-foreground">مفيش حسابات مضافة — ضيف أول أكونت وهيتدرّب قبل ما يشتغل.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.accounts.map((a) => {
              const st = ACCOUNT_STATUS[a.status] ?? ACCOUNT_STATUS.DISABLED
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold" dir="ltr">{a.handle}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{a.platform}</Badge>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      <span className="text-[10px] text-muted-foreground">{a.sentToday}/{a.dailyLimit} النهاردة</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {a.status !== "ACTIVE" && <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setStatus(a, "ACTIVE")}>تفعيل</Button>}
                    {a.status === "ACTIVE" && <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setStatus(a, "COOLDOWN")}>استراحة</Button>}
                    <button onClick={() => remove(a)} className="text-muted-foreground/60 hover:text-destructive" aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SequencesView() {
  return (
    <div className="space-y-4">
      <SequencesSection />
      <AccountsSection />
      <ExperimentsSection />
    </div>
  )
}
