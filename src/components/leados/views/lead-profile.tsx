"use client";
// LeadOS — Lead Profile 360° (doc §22, §49)
import { useState } from "react"
import { useApi, apiSend, ScoreRing, TempBadge, StatusBadge, IntentBadge, SourceBadge, ConfidenceLabel, timeAgo, fmtNum, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowRight, Star, Globe, MapPin, Phone, Mail, MessageCircle, FlaskConical,
  CheckSquare, StickyNote, History, Link2, Target, AlertTriangle, Lightbulb, Factory, Users2,
} from "lucide-react"
import { LEAD_STATUSES, LEAD_STATUS_LABELS, serviceAr, industryAr, RESEARCH_STATUS_LABELS, FINDING_TYPE_LABELS, INTERACTION_TYPE_LABELS, TASK_STATUS_LABELS, asArray } from "@/lib/constants"

interface LeadBundle {
    id: string
    status: string
    temperature: string
    intent: string
    leadSourceType: string
    score: number
    intentScore: number
    fitScore: number
    urgencyScore: number
    serviceNeeds: string[]
    painPoints: string[]
    summary: string | null
    whyNow: string | null
    nextBestAction: string | null
    lastContactedAt: string | null
    nextFollowUpAt: string | null
    lostReason: string | null
    updatedAt: string | null
    assignedTo: { id: string; name: string } | null
    business: {
      id: string; name: string; category: string | null; industry: string | null; description: string | null
      city: string | null; address: string | null; phone: string | null; email: string | null
      websiteUrl: string | null; mapsUrl: string | null; rating: number | null; reviewCount: number | null
      employeeCount: number | null
      websites: Array<{
        id: string; url: string; title: string | null; description: string | null; cms: string | null
        performanceScore: number | null; mobileScore: number | null; seoScore: number | null; uxScore: number | null
        hasWhatsapp: boolean | null; hasBooking: boolean | null; hasOrdering: boolean | null; hasEcommerce: boolean | null
        auditData: { issues?: string[] } | null
      }>
      socialProfiles: Array<{ id: string; sourceType: string; profileUrl: string; handle: string | null; followerCount: number | null }>
      reviews: Array<{ id: string; authorName: string | null; rating: number | null; text: string | null; publishedAt: string | null; sentiment: string | null; painPoints: string[] }>
      branches: Array<{ id: string; name: string | null; city: string | null }>
    } | null
    researchRuns: Array<{ id: string; depth: string; status: string; progress: number; summary: string | null; whyNow: string | null; scoreBefore: number | null; scoreAfter: number | null; createdAt: string; completedAt: string | null }>
    findings: Array<{ id: string; type: string; category: string | null; title: string; statement: string; confidence: string; confidenceScore: number; sourceUrl: string | null; createdAt: string }>
    opportunities: Array<{ id: string; service: string; title: string; description: string | null; score: number; confidence: number; status: string; reason: string | null }>
    tasks: Array<{ id: string; title: string; description: string | null; status: string; dueAt: string | null; priority: number }>
    notes: Array<{ id: string; body: string; createdAt: string; user: { name: string } | null }>
    activities: Array<{ id: string; type: string; subject: string | null; body: string | null; occurredAt: string; user: { name: string } | null }>
    sourceLinks: Array<{ id: string; sourceType: string; sourceUrl: string | null; label: string | null }>
  }

interface ProfileData {
  lead: LeadBundle
  findingsByStage: Record<string, LeadBundle["findings"]>
}

export function LeadProfileView({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const { data, loading, error, refresh } = useApi<ProfileData>(`/api/leads/${leadId}`)
  const { toast } = useToast()
  const [noteText, setNoteText] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [busy, setBusy] = useState(false)

  if (loading && !data) return <LoadingBlock label="جارٍ تحميل ملف العميل..." />
  if (error) return <EmptyState title="تعذر تحميل الملف" hint={error} />
  if (!data) return null

  const { lead } = data
  const biz = lead.business

  const changeStatus = async (status: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/leads/${lead.id}`, "PATCH", { status })
      toast({ title: `تم النقل إلى: ${LEAD_STATUS_LABELS[status]}` })
      refresh()
    } finally { setBusy(false) }
  }

  const startResearch = async (depth: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/leads/${lead.id}/research`, "POST", { depth })
      toast({ title: "بدأ البحث العميق — تابعه من مركز الأبحاث" })
      refresh()
    } catch (e) {
      toast({ title: "تعذر بدء البحث", variant: "destructive" })
    } finally { setBusy(false) }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setBusy(true)
    try {
      await apiSend(`/api/leads/${lead.id}/notes`, "POST", { body: noteText })
      setNoteText("")
      toast({ title: "تمت إضافة الملاحظة" })
      refresh()
    } finally { setBusy(false) }
  }

  const addTask = async () => {
    if (!taskTitle.trim()) return
    setBusy(true)
    try {
      await apiSend(`/api/leads/${lead.id}/tasks`, "POST", { title: taskTitle })
      setTaskTitle("")
      toast({ title: "تمت إضافة المهمة" })
      refresh()
    } finally { setBusy(false) }
  }

  const completeTask = async (taskId: string) => {
    await apiSend(`/api/tasks/${taskId}`, "PATCH", { status: "DONE" }).catch(() => undefined)
    refresh()
  }

  const reviewStats = biz?.reviews.length
    ? {
        positive: Math.round((biz.reviews.filter((r) => (r.rating ?? 5) >= 4).length / biz.reviews.length) * 100),
        pains: [...new Set(biz.reviews.flatMap((r) => r.painPoints ?? []))].slice(0, 6),
      }
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border/70">
        <CardContent className="p-4 md:p-5">
          <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-3.5 w-3.5" /> رجوع للقائمة
          </button>
          <div className="flex flex-wrap items-center gap-4">
            <ScoreRing score={lead.score} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold">{biz?.name ?? "عميل"}</h1>
                <TempBadge temp={lead.temperature} />
                <StatusBadge status={lead.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <IntentBadge intent={lead.intent} />
                <span>{biz?.city ?? "—"} • {biz?.industry ? industryAr(biz.industry) : "—"}</span>
                <span>المصدر: {lead.sourceLinks[0]?.label ?? lead.leadSourceType}</span>
                {lead.assignedTo && <span>المسؤول: {lead.assignedTo.name}</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={lead.status} onValueChange={changeStatus} disabled={busy}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => (
                    <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="gap-1.5" onClick={() => startResearch("DEEP")} disabled={busy}>
                <FlaskConical className="h-4 w-4" /> بحث عميق
              </Button>
              {biz?.phone && (
                <a href={`https://wa.me/${biz.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-1.5"><MessageCircle className="h-4 w-4" /> واتساب</Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" dir="rtl">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="company">الشركة</TabsTrigger>
          <TabsTrigger value="website">الموقع</TabsTrigger>
          <TabsTrigger value="reviews">المراجعات</TabsTrigger>
          <TabsTrigger value="opportunities">الفرص ({lead.opportunities.length})</TabsTrigger>
          <TabsTrigger value="research">الأبحاث ({lead.researchRuns.length})</TabsTrigger>
          <TabsTrigger value="tasks">المهام ({lead.tasks.filter((t) => t.status !== "DONE").length})</TabsTrigger>
          <TabsTrigger value="notes">الملاحظات ({lead.notes.length})</TabsTrigger>
          <TabsTrigger value="timeline">السجل</TabsTrigger>
          <TabsTrigger value="sources">المصادر</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-3 space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="border-border/70 lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4 text-primary" /> الملخص الاستخباري</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm leading-7">
                <p>{lead.summary ?? "لا يوجد ملخص بعد — شغّل بحثًا عميقًا"}</p>
                {lead.whyNow && (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                    <p className="text-xs font-bold text-amber-300">لماذا الآن؟</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">{lead.whyNow}</p>
                  </div>
                )}
                {lead.nextBestAction && (
                  <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                    <p className="text-xs font-bold text-primary">أفضل إجراء تالٍ</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">{lead.nextBestAction}</p>
                  </div>
                )}
                {lead.lostReason && lead.lostReason !== "—" && (
                  <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3">
                    <p className="text-xs font-bold text-rose-300">سبب الخسارة</p>
                    <p className="mt-1 text-xs text-muted-foreground">{lead.lostReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="space-y-3">
              <Card className="border-border/70">
                <CardHeader className="pb-2"><CardTitle className="text-sm">مكونات الـScore</CardTitle></CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  {[
                    { label: "نية الشراء", v: lead.intentScore },
                    { label: "ملاءمة النشاط", v: lead.fitScore },
                    { label: "الاستعجال", v: lead.urgencyScore },
                  ].map((x) => (
                    <div key={x.label}>
                      <div className="mb-1 flex justify-between"><span className="text-muted-foreground">{x.label}</span><span className="font-bold">{x.v}%</span></div>
                      <Progress value={x.v} className="h-1.5" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-border/70">
                <CardHeader className="pb-2"><CardTitle className="text-sm">الخدمات المحتملة</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {lead.serviceNeeds.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  {lead.serviceNeeds.map((s) => (
                    <Badge key={s} variant="outline" className="border-primary/30 text-primary">{serviceAr(s)}</Badge>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-border/70">
                <CardHeader className="pb-2"><CardTitle className="text-sm">نقاط الألم</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {lead.painPoints.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  {lead.painPoints.map((p) => (
                    <Badge key={p} variant="outline" className="border-rose-500/30 text-rose-300">{p}</Badge>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Company */}
        <TabsContent value="company" className="mt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border-border/70">
              <CardHeader className="pb-2"><CardTitle className="text-sm">بيانات التواصل</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> <span dir="ltr">{biz?.phone ?? "—"}</span></p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> <span dir="ltr">{biz?.email ?? "—"}</span></p>
                <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" />
                  {biz?.websiteUrl ? <a href={biz.websiteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline" dir="ltr">{biz.websiteUrl}</a> : "لا يوجد موقع"}
                </p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {biz?.address ?? "—"}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardHeader className="pb-2"><CardTitle className="text-sm">نبذة النشاط</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Factory className="h-4 w-4" /> {biz?.category ?? "—"} • {biz?.employeeCount ? `${biz.employeeCount} موظف تقديري` : "—"}
                </p>
                <p className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold">{biz?.rating ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">من {fmtNum(biz?.reviewCount)} مراجعة</span>
                </p>
                {biz?.branches && biz.branches.length > 0 && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground"><Users2 className="h-4 w-4" /> {biz.branches.length} فرع</p>
                )}
                {biz?.mapsUrl && (
                  <a href={biz.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                    <MapPin className="h-3.5 w-3.5" /> فتح على خرائط جوجل
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Website */}
        <TabsContent value="website" className="mt-3">
          {biz?.websites.length === 0 || !biz?.websites?.length ? (
            <EmptyState icon={<Globe className="h-10 w-10" />} title="لا يوجد موقع إلكتروني مسجل" hint="غياب الموقع نفسه فرصة خدمية قوية — سجلها في الفرص" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {biz.websites.map((w) => (
                <Card key={w.id} className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-sm">
                      <a href={w.url} target="_blank" rel="noreferrer" dir="ltr" className="truncate text-primary hover:underline">{w.url}</a>
                      <Badge variant="outline">{w.cms ?? "—"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: "الأداء", v: w.performanceScore }, { label: "الموبايل", v: w.mobileScore },
                        { label: "SEO", v: w.seoScore }, { label: "UX", v: w.uxScore },
                      ].map((x) => (
                        <div key={x.label} className="rounded-lg border border-border/50 bg-secondary/40 p-2">
                          <p className={`text-lg font-extrabold ${(x.v ?? 0) >= 60 ? "text-emerald-400" : (x.v ?? 0) >= 40 ? "text-amber-400" : "text-rose-400"}`}>{x.v ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{x.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <Badge variant="outline" className={(w.hasWhatsapp ? "text-emerald-300" : "text-rose-300")}>واتساب {w.hasWhatsapp ? "✓" : "✗"}</Badge>
                      <Badge variant="outline" className={(w.hasBooking ? "text-emerald-300" : "text-rose-300")}>حجز {w.hasBooking ? "✓" : "✗"}</Badge>
                      <Badge variant="outline" className={(w.hasOrdering ? "text-emerald-300" : "text-rose-300")}>طلبات {w.hasOrdering ? "✓" : "✗"}</Badge>
                      <Badge variant="outline" className={(w.hasEcommerce ? "text-emerald-300" : "text-rose-300")}>تجارة {w.hasEcommerce ? "✓" : "✗"}</Badge>
                    </div>
                    {w.auditData?.issues && w.auditData.issues.length > 0 && (
                      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
                        <p className="text-xs font-bold text-amber-300">قضايا مكتشفة</p>
                        <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                          {w.auditData.issues.map((i) => <li key={i}>{i}</li>)}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews" className="mt-3 space-y-3">
          {reviewStats && (
            <div className="flex flex-wrap items-center gap-3">
              <Card className="flex-1 border-border/70 p-3">
                <p className="text-xs text-muted-foreground">التحليل: <span className="font-bold text-emerald-400">{reviewStats.positive}% إيجابي</span> • <span className="font-bold text-rose-400">{100 - reviewStats.positive}% سلبي</span></p>
              </Card>
            </div>
          )}
          {reviewStats?.pains.length ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> شكاوى متكررة</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {reviewStats.pains.map((p) => <Badge key={p} variant="outline" className="border-amber-500/30 text-amber-200">{p}</Badge>)}
              </div>
            </div>
          ) : null}
          {(biz?.reviews ?? []).map((r) => (
            <Card key={r.id} className="border-border/60">
              <CardContent className="flex items-start gap-3 p-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                  (r.rating ?? 0) >= 4 ? "bg-emerald-500/15 text-emerald-300" : (r.rating ?? 0) === 3 ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"
                }`}>
                  {r.rating ?? "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold">{r.authorName ?? "مستخدم"}</p>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(r.publishedAt)}</span>
                    {r.sentiment && (
                      <span className={`text-[10px] font-bold ${r.sentiment === "POSITIVE" ? "text-emerald-300" : r.sentiment === "NEGATIVE" ? "text-rose-300" : "text-amber-300"}`}>
                        {r.sentiment === "POSITIVE" ? "إيجابي" : r.sentiment === "NEGATIVE" ? "سلبي" : "محايد"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{r.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {biz?.reviews.length === 0 && <EmptyState title="لا توجد مراجعات محللة" />}
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities" className="mt-3 space-y-3">
          {lead.opportunities.length === 0 && <EmptyState icon={<Lightbulb className="h-10 w-10" />} title="لا توجد فرص مكتشفة بعد" hint="شغّل بحثًا عميقًا ليكتشف النظام الفرص بناءً على الأدلة" />}
          {lead.opportunities.map((o) => (
            <Card key={o.id} className="border-border/70">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
                  <span className="text-sm font-extrabold text-violet-300">{o.score}</span>
                  <span className="text-[9px] text-violet-400/70">فرصة</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{o.title}</p>
                    <Badge variant="outline" className="text-[10px]">{serviceAr(o.service)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{o.status === "OPEN" ? "مفتوحة" : o.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{o.description ?? o.reason}</p>
                </div>
                <div className="text-end">
                  <p className="text-[10px] text-muted-foreground">الثقة</p>
                  <p className="text-sm font-bold text-emerald-400">{o.confidence}%</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Research */}
        <TabsContent value="research" className="mt-3 space-y-3">
          {lead.researchRuns.length === 0 && <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="لم يتم تشغيل بحث عميق بعد" />}
          {lead.researchRuns.map((r) => (
            <Card key={r.id} className="border-border/70">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-violet-500/30 text-violet-300">
                    {r.depth === "QUICK" ? "سريع" : r.depth === "DEEP" ? "عميق" : "عميق جدًا"}
                  </Badge>
                  <span className={`text-xs font-bold ${r.status === "COMPLETED" ? "text-emerald-300" : r.status === "RUNNING" ? "text-sky-300" : "text-amber-300"}`}>
                    {RESEARCH_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  {r.scoreBefore != null && r.scoreAfter != null && (
                    <span className="ms-auto text-xs font-bold text-primary">{r.scoreBefore} → {r.scoreAfter}</span>
                  )}
                </div>
                {r.status === "RUNNING" && <Progress value={r.progress} className="mt-2 h-1.5" />}
                {r.summary && <p className="mt-2 text-xs leading-6 text-muted-foreground">{r.summary}</p>}
              </CardContent>
            </Card>
          ))}

          {lead.findings.length > 0 && (
            <Card className="border-border/70">
              <CardHeader className="pb-2"><CardTitle className="text-sm">الأدلة والاستنتاجات (Evidence)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lead.findings.slice(0, 12).map((f) => (
                  <div key={f.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{FINDING_TYPE_LABELS[f.type] ?? f.type}</Badge>
                      <p className="text-xs font-bold">{f.title}</p>
                      <span className="ms-auto"><ConfidenceLabel conf={f.confidence} /></span>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">{f.statement}</p>
                    {f.sourceUrl && (
                      <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                        <Link2 className="h-3 w-3" /> المصدر
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="مهمة جديدة — مثال: اتصال متابعة" onKeyDown={(e) => e.key === "Enter" && addTask()} />
            <Button onClick={addTask} disabled={busy}>إضافة</Button>
          </div>
          {lead.tasks.length === 0 && <EmptyState title="لا توجد مهام" />}
          {lead.tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <input
                type="checkbox"
                checked={t.status === "DONE"}
                onChange={() => completeTask(t.id)}
                className="h-4 w-4 accent-[var(--primary)]"
                aria-label="إتمام المهمة"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${t.status === "DONE" ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                {t.description && <p className="truncate text-xs text-muted-foreground">{t.description}</p>}
              </div>
              <Badge variant="outline" className="text-[10px]">{TASK_STATUS_LABELS[t.status] ?? t.status}</Badge>
              <span className="hidden text-[10px] text-muted-foreground sm:block">{t.dueAt ? `مستحقة ${timeAgo(t.dueAt)}` : ""}</span>
            </div>
          ))}
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-3 space-y-3">
          <div className="space-y-2">
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="اكتب ملاحظة عن هذا العميل..." rows={3} />
            <Button onClick={addNote} disabled={busy || !noteText.trim()} className="gap-1.5">
              <StickyNote className="h-4 w-4" /> إضافة ملاحظة
            </Button>
          </div>
          {lead.notes.length === 0 && <EmptyState title="لا توجد ملاحظات" />}
          {lead.notes.map((n) => (
            <Card key={n.id} className="border-border/60">
              <CardContent className="p-3">
                <p className="text-sm leading-7">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{n.user?.name ?? "—"} • {timeAgo(n.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-3">
          <Card className="border-border/70">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" /> كل ما حدث للعميل</CardTitle></CardHeader>
            <CardContent>
              <div className="relative space-y-3 before:absolute before:bottom-2 before:right-[11px] before:top-2 before:w-px before:bg-border">
                {lead.activities.map((a) => (
                  <div key={a.id} className="relative flex gap-3">
                    <div className="z-10 mt-1 h-[22px] w-[22px] shrink-0 rounded-full border border-primary/40 bg-primary/10" />
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{INTERACTION_TYPE_LABELS[a.type] ?? a.type}</Badge>
                        <p className="text-xs font-bold">{a.subject ?? "—"}</p>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(a.occurredAt)}</span>
                      </div>
                      {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources */}
        <TabsContent value="sources" className="mt-3 space-y-2">
          {lead.sourceLinks.length === 0 && <EmptyState title="لا توجد مصادر" />}
          {lead.sourceLinks.map((s) => (
            <Card key={s.id} className="border-border/60">
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <SourceBadge type={s.sourceType} />
                <span className="text-xs font-bold">{s.label ?? "—"}</span>
                {s.sourceUrl && (
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline" dir="ltr">
                    <Link2 className="h-3 w-3" /> فتح المصدر
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
          {(biz?.socialProfiles ?? []).map((sp) => (
            <Card key={sp.id} className="border-border/60">
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <SourceBadge type={sp.sourceType} />
                <span className="text-xs font-bold" dir="ltr">{sp.handle ?? sp.profileUrl}</span>
                {sp.followerCount && <span className="text-xs text-muted-foreground">{fmtNum(sp.followerCount)} متابع</span>}
                <a href={sp.profileUrl} target="_blank" rel="noreferrer" className="ms-auto text-[11px] text-primary hover:underline">فتح</a>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <CheckSquare className="h-3 w-3" />
        آخر تحديث للملف: {timeAgo(lead.updatedAt ?? null)} — كل المعلومات موثقة بمصادرها
      </div>
    </div>
  )
}
