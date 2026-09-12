"use client";
// LeadOS — Leads table + filters + saved views (doc §48.3, §24)
import { useMemo, useState } from "react"
import { useApi, apiSend, ScoreBadge, TempBadge, StatusBadge, IntentBadge, SourceBadge, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Search, Plus, Bookmark, Users } from "lucide-react"
import { LEAD_STATUSES, LEAD_STATUS_LABELS, SOURCE_TYPES, LEAD_SOURCE_TYPE_LABELS, SERVICE_CATALOG, INDUSTRY_CATALOG, serviceAr, industryAr } from "@/lib/constants"

interface LeadRow {
  id: string
  status: string
  temperature: string
  intent: string
  leadSourceType: string
  score: number
  serviceNeeds: string[]
  summary: string | null
  lastSeenAt: string
  updatedAt: string
  business: { name: string; city: string; industry: string; category: string; rating: number; reviewCount: number; phone: string; websiteUrl: string } | null
  assignedTo: { name: string } | null
  _count: { opportunities: number; notes: number; tasks: number; researchRuns: number }
}

const SAVED_VIEWS: Array<{ name: string; filters: Record<string, string> }> = [
  { name: "HOT Leads اليوم", filters: { temperature: "HOT" } },
  { name: "لم يتم التواصل معهم", filters: { status: "NEW" } },
  { name: "Score فوق 80", filters: { minScore: "80" } },
]

export function LeadsView({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("ALL")
  const [temperature, setTemperature] = useState("ALL")
  const [source, setSource] = useState("ALL")
  const [minScore, setMinScore] = useState("0")
  const { toast } = useToast()

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set("q", q)
    if (status !== "ALL") p.set("status", status)
    if (temperature !== "ALL") p.set("temperature", temperature)
    if (source !== "ALL") p.set("source", source)
    if (Number(minScore) > 0) p.set("minScore", minScore)
    return `/api/leads?${p.toString()}`
  }, [q, status, temperature, source, minScore])

  const { data, loading, refresh } = useApi<{ leads: LeadRow[]; facets: { industries: string[]; cities: string[] } }>(query)

  const applySaved = (f: Record<string, string>) => {
    setStatus(f.status ?? "ALL")
    setTemperature(f.temperature ?? "ALL")
    setMinScore(f.minScore ?? "0")
    setSource(f.source ?? "ALL")
    setQ("")
  }

  // Manual lead dialog
  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState({ companyName: "", industry: "", city: "", phone: "", websiteUrl: "", summary: "" })
  const [saving, setSaving] = useState(false)
  const createLead = async () => {
    if (!form.companyName.trim()) { toast({ title: "اسم الشركة مطلوب" }); return }
    setSaving(true)
    try {
      await apiSend("/api/leads", "POST", form)
      toast({ title: "تمت إضافة الـLead بنجاح" })
      setDlgOpen(false)
      setForm({ companyName: "", industry: "", city: "", phone: "", websiteUrl: "", summary: "" })
      refresh()
    } catch (e) {
      toast({ title: "خطأ", description: e instanceof Error ? e.message : "تعذر الإضافة", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Saved views */}
      <div className="flex flex-wrap items-center gap-2">
        <Bookmark className="h-4 w-4 text-muted-foreground" />
        {SAVED_VIEWS.map((v) => (
          <button
            key={v.name}
            onClick={() => applySaved(v.filters)}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs transition-colors hover:border-primary/40 hover:text-primary"
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/70">
        <CardContent className="flex flex-wrap items-end gap-2 p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو المدينة..." className="pe-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="المرحلة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">كل المراحل</SelectItem>
              {LEAD_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => (
                <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={temperature} onValueChange={setTemperature}>
            <SelectTrigger className="w-32"><SelectValue placeholder="الحرارة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">كل الحرارة</SelectItem>
              <SelectItem value="HOT">ساخن</SelectItem>
              <SelectItem value="WARM">دافئ</SelectItem>
              <SelectItem value="COLD">بارد</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-40"><SelectValue placeholder="المصدر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">كل المصادر</SelectItem>
              {SOURCE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>{LEAD_SOURCE_TYPE_LABELS[s] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Score" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">كل النتائج</SelectItem>
              <SelectItem value="50">50+</SelectItem>
              <SelectItem value="75">75+</SelectItem>
              <SelectItem value="85">85+</SelectItem>
              <SelectItem value="90">90+</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5"><Plus className="h-4 w-4" /> إضافة Lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>إضافة عميل محتمل يدويًا</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {[
                  { key: "companyName" as const, label: "اسم الشركة", required: true },
                  { key: "city" as const, label: "المدينة" },
                  { key: "phone" as const, label: "الهاتف", ltr: true },
                  { key: "websiteUrl" as const, label: "الموقع الإلكتروني", ltr: true },
                ].map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label>{f.label}{f.required ? " *" : ""}</Label>
                    <Input
                      dir={f.ltr ? "ltr" : undefined}
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label>النشاط</Label>
                  <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر النشاط" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_CATALOG.map((i) => <SelectItem key={i.key} value={i.key}>{i.ar}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>ملاحظة</Label>
                  <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="سياق بسيط عن هذا العميل" />
                </div>
                <Button className="w-full" onClick={createLead} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/70">
        <CardContent className="p-0">
          {loading && !data ? <LoadingBlock /> : data?.leads.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} title="لا توجد نتائج مطابقة" hint="عدّل الفلاتر أو شغّل دورة اكتشاف جديدة" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-xs text-muted-foreground">
                    <th className="p-3 text-start font-semibold">الشركة</th>
                    <th className="p-3 text-start font-semibold">Score</th>
                    <th className="hidden p-3 text-start font-semibold md:table-cell">الحرارة</th>
                    <th className="hidden p-3 text-start font-semibold md:table-cell">النية</th>
                    <th className="p-3 text-start font-semibold">المرحلة</th>
                    <th className="hidden p-3 text-start font-semibold lg:table-cell">الخدمات المطلوبة</th>
                    <th className="hidden p-3 text-start font-semibold lg:table-cell">المصدر</th>
                    <th className="hidden p-3 text-start font-semibold sm:table-cell">الفرص</th>
                    <th className="hidden p-3 text-start font-semibold sm:table-cell">آخر ظهور</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.leads.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => onOpenLead(l.id)}
                      className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-accent/40"
                    >
                      <td className="max-w-56 p-3">
                        <p className="truncate font-bold">{l.business?.name ?? "بدون اسم"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {l.business?.city ?? "—"} • {l.business?.industry ? industryAr(l.business.industry) : "—"}
                          {l.business?.rating ? ` • ${l.business.rating}★ (${l.business.reviewCount})` : ""}
                        </p>
                      </td>
                      <td className="p-3"><ScoreBadge score={l.score} /></td>
                      <td className="hidden p-3 md:table-cell"><TempBadge temp={l.temperature} /></td>
                      <td className="hidden p-3 md:table-cell"><IntentBadge intent={l.intent} /></td>
                      <td className="p-3"><StatusBadge status={l.status} /></td>
                      <td className="hidden max-w-44 p-3 lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {l.serviceNeeds.slice(0, 3).map((s) => (
                            <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{serviceAr(s)}</span>
                          ))}
                        </div>
                      </td>
                      <td className="hidden p-3 lg:table-cell"><SourceBadge type={l.leadSourceType} /></td>
                      <td className="hidden p-3 sm:table-cell text-xs font-bold">{l._count.opportunities}</td>
                      <td className="hidden p-3 text-xs text-muted-foreground sm:table-cell">{timeAgo(l.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
