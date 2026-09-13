"use client";
// LeadOS — Sources management (doc §48.7, §51)
import { useState } from "react"
import { useApi, apiSend, timeAgo, SourceBadge, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Database, Plus, Trash2, Activity, AlertCircle } from "lucide-react"
import { SOURCE_TYPES, SOURCE_TYPE_LABELS } from "@/lib/constants"

interface SourceRow {
  id: string
  type: string
  name: string
  status: string
  scheduleCron: string | null
  lastRunAt: string | null
  nextRunAt: string | null
  lastError: string | null
  _count: { contents: number; searchJobs: number }
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "سليم", cls: "bg-emerald-500/15 text-emerald-300" },
  PAUSED: { label: "موقوف مؤقتًا", cls: "bg-amber-500/15 text-amber-300" },
  ERROR: { label: "به خطأ", cls: "bg-rose-500/15 text-rose-300" },
  DISABLED: { label: "معطل", cls: "bg-slate-500/15 text-slate-400" },
}

export function SourcesView() {
  const { data, loading, refresh } = useApi<{ sources: SourceRow[] }>("/api/sources")
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", type: "GOOGLE_SEARCH", scheduleCron: "*/15 * * * *" })
  const [saving, setSaving] = useState(false)

  const toggle = async (s: SourceRow, enabled: boolean) => {
    await apiSend(`/api/sources/${s.id}`, "PATCH", { status: enabled ? "ACTIVE" : "PAUSED" })
    toast({ title: enabled ? `تم تفعيل: ${s.name}` : `تم إيقاف: ${s.name}` })
    refresh()
  }

  const create = async () => {
    if (!form.name.trim()) { toast({ title: "اسم المصدر مطلوب" }); return }
    setSaving(true)
    try {
      await apiSend("/api/sources", "POST", form)
      toast({ title: "تمت إضافة المصدر" })
      setOpen(false)
      setForm({ name: "", type: "GOOGLE_SEARCH", scheduleCron: "*/15 * * * *" })
      refresh()
    } finally { setSaving(false) }
  }

  const remove = async (s: SourceRow) => {
    await apiSend(`/api/sources/${s.id}`, "DELETE")
    toast({ title: `تم حذف: ${s.name}` })
    refresh()
  }

  if (loading && !data) return <LoadingBlock />
  const sources = data?.sources ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">كل مصدر له Adapter مستقل يعمل حسب جدولته — الإيقاف يوقف جمع البيانات من المصدر فورًا</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> مصدر جديد</Button></DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>إضافة مصدر اكتشاف</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>الاسم</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: جروبات ريديت مصرية" />
              </div>
              <div className="space-y-1">
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الجدولة (Cron)</Label>
                <Input dir="ltr" value={form.scheduleCron} onChange={(e) => setForm({ ...form, scheduleCron: e.target.value })} className="font-mono text-xs" />
              </div>
              <Button className="w-full" onClick={create} disabled={saving}>{saving ? "جارٍ الإضافة..." : "إضافة"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sources.length === 0 ? (
        <EmptyState icon={<Database className="h-10 w-10" />} title="لا توجد مصادر" hint="أضف مصدرًا ليبدأ النظام الاكتشاف" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((s) => {
            const st = STATUS_LABELS[s.status] ?? STATUS_LABELS.DISABLED
            const enabled = s.status === "ACTIVE"
            return (
              <Card key={s.id} className="border-border/70">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{s.name}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <SourceBadge type={s.type} />
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                    <Switch checked={enabled} onCheckedChange={(v) => toggle(s, v)} aria-label="تشغيل/إيقاف المصدر" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="rounded-lg bg-secondary/50 p-2">
                      <p className="text-sm font-extrabold">{s._count.contents}</p>
                      <p className="text-muted-foreground">محتوى مجمع</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-2">
                      <p className="text-sm font-extrabold">{s._count.searchJobs}</p>
                      <p className="text-muted-foreground">عمليات بحث</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-2">
                      <p className="truncate font-mono text-[9px] font-bold leading-5" dir="ltr">{s.scheduleCron ?? "—"}</p>
                      <p className="text-muted-foreground">الجدولة</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> آخر تشغيل: {timeAgo(s.lastRunAt)}</span>
                    <button onClick={() => remove(s)} className="text-muted-foreground/60 hover:text-destructive" aria-label="حذف المصدر">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {s.lastError && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2 text-[10px] text-amber-200">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {s.lastError}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
