"use client";
// LeadOS — CRM Pipeline Kanban (doc §23, §48.4)
import { useState } from "react"
import { useApi, apiSend, ScoreBadge, TempBadge, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { KanbanSquare } from "lucide-react"
import { PIPELINE_ORDER, LEAD_STATUS_LABELS, serviceAr } from "@/lib/constants"

interface StageColumn {
  id: string
  name: string
  position: number
  color: string | null
  probability: number | null
  leads: KanbanLead[]
}
interface KanbanLead {
  id: string
  score: number
  temperature: string
  intent: string
  company: string
  city: string
  industry: string
  opportunities: Array<{ title: string; score: number }>
  updatedAt: string
}

const STAGE_COLORS: Record<string, string> = {
  NEW: "#6b7280", QUALIFIED: "#0ea5e9", CONTACTED: "#8b5cf6", REPLIED: "#a855f7",
  INTERESTED: "#ec4899", MEETING: "#f97316", PROPOSAL: "#eab308",
  WON: "#22c55e", LOST: "#ef4444", NURTURE: "#14b8a6",
}

export function PipelineView({ panel, onOpenLead }: { panel: string; onOpenLead: (id: string) => void }) {
  const { data, loading, refresh } = useApi<{ stages: StageColumn[]; unmatchedCount: number }>(`/api/pipeline?panel=${panel}`)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const { toast } = useToast()

  const move = async (statusKey: string) => {
    if (!dragId) return
    try {
      await apiSend("/api/pipeline", "PATCH", { leadId: dragId, status: statusKey })
      toast({ title: `تم النقل إلى: ${LEAD_STATUS_LABELS[statusKey] ?? statusKey}` })
      refresh()
    } catch (e) {
      toast({ title: "تعذر النقل", description: e instanceof Error ? e.message : "", variant: "destructive" })
    } finally {
      setDragId(null)
      setOverStage(null)
    }
  }

  if (loading && !data) return <LoadingBlock />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <KanbanSquare className="h-4 w-4" />
        اسحب كارت العميل وأفلته في العمود الجديد — أو افتح ملفه لتغيير المرحلة
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {data.stages.map((stage) => {
          const statusKey = PIPELINE_ORDER.find((k) => LEAD_STATUS_LABELS[k] === stage.name) ?? ""
          const isOver = overStage === stage.id
          return (
            <div
              key={stage.id}
              className={`kanban-column w-64 shrink-0 rounded-2xl border p-2 transition-colors ${
                isOver ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card/60"
              }`}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id) }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={() => statusKey && move(statusKey)}
            >
              <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLORS[statusKey] ?? stage.color ?? "#6b7280" }} />
                <p className="text-xs font-extrabold">{stage.name}</p>
                <span className="ms-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{stage.leads.length}</span>
              </div>
              <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto p-0.5">
                {stage.leads.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-[11px] text-muted-foreground/60">فارغ</div>
                )}
                {stage.leads.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null) }}
                    onClick={() => onOpenLead(l.id)}
                    className={`cursor-grab rounded-xl border border-border/70 bg-card p-3 transition-all hover:border-primary/40 hover:shadow-lg active:cursor-grabbing ${dragId === l.id ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={l.score} />
                      <TempBadge temp={l.temperature} />
                    </div>
                    <p className="mt-2 truncate text-sm font-bold">{l.company ?? "—"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{l.city ?? "—"} • {l.industry ?? "—"}</p>
                    {l.opportunities.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {l.opportunities.map((o) => (
                          <Badge key={o.title} variant="outline" className="border-violet-500/30 px-1.5 py-0 text-[9px] text-violet-300">{o.title}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {data.unmatchedCount > 0 && (
        <p className="text-xs text-muted-foreground">* {data.unmatchedCount} عميل خارج الأعمدة الافتراضية (مؤرشف)</p>
      )}
    </div>
  )
}
