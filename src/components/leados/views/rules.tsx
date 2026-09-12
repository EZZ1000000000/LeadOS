"use client";
// LeadOS — Search Rules engine UI (doc §27, §48.8)
import { useState } from "react"
import { useApi, apiSend, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { SlidersHorizontal, Plus, Trash2, SearchCode, ShieldOff } from "lucide-react"
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, SERVICE_CATALOG, INDUSTRY_CATALOG, RESEARCH_DEPTHS, RESEARCH_DEPTH_LABELS, asArray, serviceAr, industryAr } from "@/lib/constants"

interface RuleRow {
  id: string
  name: string
  description: string | null
  enabled: boolean
  priority: number
  cities: string[]
  industries: string[]
  services: string[]
  keywords: string[]
  excludedWords: string[]
  sourceTypes: string[]
  minLeadScore: number
  researchDepth: string
  _count: { searches: number }
}

export function RulesView() {
  const { data, loading, refresh } = useApi<{ rules: RuleRow[] }>("/api/rules")
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState<string[] | null>(null)
  const [form, setForm] = useState({
    name: "", description: "",
    cities: "Cairo, Giza", industries: "cafe", services: "pos",
    keywords: "", excludedWords: "وظيفة, توظيف",
    sourceTypes: "GOOGLE_SEARCH,GOOGLE_MAPS", minLeadScore: "70", researchDepth: "DEEP",
  })

  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean)

  const create = async () => {
    if (!form.name.trim()) { toast({ title: "اسم القاعدة مطلوب" }); return }
    setSaving(true)
    try {
      const res = await apiSend<{ rule: RuleRow; plan: { queries: string[] } }>("/api/rules", "POST", {
        name: form.name,
        description: form.description,
        cities: split(form.cities),
        industries: split(form.industries),
        services: split(form.services),
        keywords: split(form.keywords),
        excludedWords: split(form.excludedWords),
        sourceTypes: split(form.sourceTypes),
        minLeadScore: Number(form.minLeadScore) || 0,
        researchDepth: form.researchDepth,
      })
      setPlan(res.plan.queries)
      toast({ title: "تم إنشاء القاعدة — ستبدأ الاكتشاف في الدورة القادمة" })
      refresh()
    } catch (e) {
      toast({ title: "خطأ", description: e instanceof Error ? e.message : "", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const toggle = async (r: RuleRow, enabled: boolean) => {
    await apiSend(`/api/rules/${r.id}`, "PATCH", { enabled })
    toast({ title: enabled ? `تم تفعيل: ${r.name}` : `تم إيقاف: ${r.name}` })
    refresh()
  }

  const remove = async (r: RuleRow) => {
    await apiSend(`/api/rules/${r.id}`, "DELETE")
    toast({ title: `تم حذف: ${r.name}` })
    refresh()
  }

  const closePlan = () => { setPlan(null); setOpen(false); setForm({ ...form, name: "" }) }

  if (loading && !data) return <LoadingBlock />
  const rules = data?.rules ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">القواعد تتحكم فيما يبحث عنه النظام 24/7 — كل قاعدة تولّد استعلامات موسعة تلقائيًا (Query Expansion)</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPlan(null) }}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> قاعدة جديدة</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إنشاء قاعدة بحث</DialogTitle></DialogHeader>
            {plan ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-bold text-primary"><SearchCode className="h-4 w-4" /> خطة الاستعلامات المولدة:</p>
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {plan.map((q) => (
                    <p key={q} dir="auto" className="rounded-lg border border-border/60 bg-secondary/40 p-2 text-xs" >{q}</p>
                  ))}
                </div>
                <Button className="w-full" onClick={closePlan}>تمام، فهمت</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>اسم القاعدة *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: كافيهات الجيزة محتاجة POS" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>المدن (فاصلة بينها)</Label>
                    <Input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>الأنشطة</Label>
                    <Input value={form.industries} onChange={(e) => setForm({ ...form, industries: e.target.value })} placeholder="cafe, restaurant" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>الخدمات المستهدفة</Label>
                    <Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="pos, website" />
                  </div>
                  <div className="space-y-1">
                    <Label>كلمات استثنائية</Label>
                    <Input value={form.excludedWords} onChange={(e) => setForm({ ...form, excludedWords: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>كلمات مفتاحية إضافية (اختياري)</Label>
                  <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="محتاج كاشير, POS Egypt" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>أقل Score للبحث العميق</Label>
                    <Input dir="ltr" type="number" value={form.minLeadScore} onChange={(e) => setForm({ ...form, minLeadScore: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>عمق البحث</Label>
                    <Select value={form.researchDepth} onValueChange={(v) => setForm({ ...form, researchDepth: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RESEARCH_DEPTHS.map((d) => <SelectItem key={d} value={d}>{RESEARCH_DEPTH_LABELS[d]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>المصادر</Label>
                  <Select value={form.sourceTypes} onValueChange={(v) => setForm({ ...form, sourceTypes: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GOOGLE_SEARCH,GOOGLE_MAPS">ويب + خرائط جوجل</SelectItem>
                      <SelectItem value="GOOGLE_SEARCH">ويب فقط</SelectItem>
                      <SelectItem value="GOOGLE_MAPS">خرائط جوجل فقط</SelectItem>
                      <SelectItem value="GOOGLE_SEARCH,REDDIT">ويب + ريديت</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={create} disabled={saving}>{saving ? "جارٍ الإنشاء..." : "إنشاء القاعدة"}</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={<SlidersHorizontal className="h-10 w-10" />} title="لا توجد قواعد بحث" hint="أنشئ أول قاعدة ليبدأ محرك الاكتشاف" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rules.map((r) => (
            <Card key={r.id} className={`border-border/70 ${!r.enabled ? "opacity-60" : ""}`}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{r.name}</p>
                    {r.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.enabled} onCheckedChange={(v) => toggle(r, v)} aria-label="تفعيل القاعدة" />
                    <button onClick={() => remove(r)} className="text-muted-foreground/60 hover:text-destructive" aria-label="حذف القاعدة">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {r.cities.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                  {r.industries.map((i) => <Badge key={i} variant="outline" className="border-sky-500/30 text-[10px] text-sky-300">{industryAr(i)}</Badge>)}
                  {r.services.map((s) => <Badge key={s} variant="outline" className="border-primary/30 text-[10px] text-primary">{serviceAr(s)}</Badge>)}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><SearchCode className="h-3 w-3" /> {r._count.searches} عملية بحث</span>
                  <span>أولوية: {r.priority}</span>
                  <span>بحث عميق: {RESEARCH_DEPTH_LABELS[r.researchDepth as keyof typeof RESEARCH_DEPTH_LABELS] ?? r.researchDepth}</span>
                  {r.minLeadScore > 0 && <span>Score ≥ {r.minLeadScore}</span>}
                </div>

                {r.excludedWords.length > 0 && (
                  <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <ShieldOff className="h-3 w-3" /> استثناءات: {r.excludedWords.join("، ")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
