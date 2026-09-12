"use client";
// LeadOS — Tasks & follow-ups (doc §31)
import { useState } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, EmptyState, ScoreBadge } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { CheckSquare, Phone, Mail, MessageCircle, Users } from "lucide-react"
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants"

interface TaskRow {
  id: string
  title: string
  description: string | null
  status: string
  dueAt: string | null
  priority: number
  lead: { id: string; business: { name: string } | null } | null
  assignedTo: { name: string } | null
}

const TASK_ICONS: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  WHATSAPP: <MessageCircle className="h-3.5 w-3.5" />,
}

export function TasksView({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const [filter, setFilter] = useState("TODO")
  const { data, loading, refresh } = useApi<{ tasks: TaskRow[] }>(`/api/tasks?status=${filter}`)
  const { toast } = useToast()

  const setStatus = async (t: TaskRow, status: string) => {
    await apiSend(`/api/tasks/${t.id}`, "PATCH", { status })
    if (status === "DONE") toast({ title: "أحسنت! مهمة منجزة" })
    refresh()
  }

  const tasks = data?.tasks ?? []
  const overdue = (t: TaskRow) => t.dueAt && new Date(t.dueAt).getTime() < Date.now() && t.status !== "DONE"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">قواعد المتابعة التلقائية: بدون رد يوم → متابعة • 3 أيام → تذكير • 7 أيام → تنمية علاقة</p>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">الكل</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? <LoadingBlock /> : tasks.length === 0 ? (
        <EmptyState icon={<CheckSquare className="h-10 w-10" />} title="لا توجد مهام" hint="المهام تُنشأ تلقائيًا من قواعد المتابعة والـAI Commander" />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className={`border-border/70 ${t.status === "DONE" ? "opacity-55" : overdue(t) ? "border-rose-500/40" : ""}`}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground">
                  {TASK_ICONS[t.title.slice(0, 2)] ?? <Users className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-bold ${t.status === "DONE" ? "line-through" : ""}`}>{t.title}</p>
                    {overdue(t) && <Badge className="bg-rose-500/15 text-[10px] text-rose-300">متأخرة</Badge>}
                    {t.priority >= 90 && <Badge className="bg-amber-500/15 text-[10px] text-amber-300">أولوية عالية</Badge>}
                  </div>
                  {t.description && <p className="truncate text-xs text-muted-foreground">{t.description}</p>}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {t.lead?.business?.name ?? "—"}
                    {t.lead && (
                      <button className="ms-2 font-bold text-primary hover:underline" onClick={() => onOpenLead(t.lead!.id)}>فتح الملف</button>
                    )}
                    {" • "}
                    {t.dueAt ? `مستحقة ${timeAgo(t.dueAt)}` : "بدون موعد"}
                    {t.assignedTo ? ` • ${t.assignedTo.name}` : ""}
                  </p>
                </div>
                <Select value={t.status} onValueChange={(v) => setStatus(t, v)}>
                  <SelectTrigger className="w-32" size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {t.status !== "DONE" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(t, "DONE")}>تمت ✓</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
