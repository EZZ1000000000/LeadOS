"use client";
// LeadOS — Research Center (doc §48.6, §50)
import { useState } from "react"
import { useApi, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { FlaskConical, CheckCircle2, Loader2 } from "lucide-react"
import { RESEARCH_STATUS_LABELS, RESEARCH_DEPTHS, RESEARCH_DEPTH_LABELS } from "@/lib/constants"

interface Run {
  id: string
  depth: string
  status: string
  progress: number
  summary: string | null
  whyNow: string | null
  scoreBefore: number | null
  scoreAfter: number | null
  createdAt: string
  completedAt: string | null
  lead: { id: string; business: { name: string; city: string; industry: string } | null } | null
  _count: { findings: number }
}

const STAGES = ["حل الهوية", "خرائط جوجل", "تحليل الموقع", "الحضور الاجتماعي", "تحليل المراجعات", "المنافسين", "التحليل النهائي"]

export function ResearchView({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const { data, loading, refresh } = useApi<{ runs: Run[] }>("/api/research")
  const [filter, setFilter] = useState("ALL")

  const runs = data?.runs.filter((r) => filter === "ALL" || r.status === filter) ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["ALL", "RUNNING", "COMPLETED", "QUEUED", "FAILED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === s ? "border-primary/50 bg-primary/10 font-bold text-primary" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {s === "ALL" ? "الكل" : RESEARCH_STATUS_LABELS[s] ?? s}
          </button>
        ))}
        <Button variant="outline" size="sm" className="ms-auto" onClick={refresh}>تحديث</Button>
      </div>

      {loading && !data ? <LoadingBlock /> : runs.length === 0 ? (
        <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="لا توجد أبحاث" hint="ابدأ بحثًا عميقًا من ملف أي عميل أو من AI Commander" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {runs.map((r) => {
            const stagesDone = r.status === "COMPLETED" ? STAGES.length : Math.floor((r.progress / 100) * STAGES.length)
            return (
              <Card key={r.id} className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    {r.status === "COMPLETED" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : r.status === "RUNNING" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                    ) : (
                      <FlaskConical className="h-4 w-4 text-amber-400" />
                    )}
                    <button className="font-extrabold hover:text-primary" onClick={() => r.lead && onOpenLead(r.lead.id)}>
                      بحث عميق: {r.lead?.business?.name ?? "—"}
                    </button>
                    <Badge variant="outline" className="text-[10px]">{RESEARCH_DEPTH_LABELS[r.depth as keyof typeof RESEARCH_DEPTH_LABELS] ?? r.depth}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={r.status === "COMPLETED" ? "font-bold text-emerald-300" : r.status === "RUNNING" ? "font-bold text-sky-300" : "text-amber-300"}>
                      {RESEARCH_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    {r.scoreBefore != null && r.scoreAfter != null && (
                      <span className="ms-auto font-bold text-primary">Score: {r.scoreBefore} → {r.scoreAfter}</span>
                    )}
                  </div>
                  {r.status === "RUNNING" ? (
                    <>
                      <Progress value={r.progress} className="h-1.5" />
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {STAGES.map((s, i) => (
                          <span key={s} className={`rounded-full px-2 py-0.5 ${i < stagesDone ? "bg-emerald-500/15 text-emerald-300" : "bg-secondary text-muted-foreground"}`}>
                            {i < stagesDone ? "✓ " : ""}{s}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2 py-0.5">{r._count.findings} استنتاج موثق</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">{timeAgo(r.completedAt ?? r.createdAt)}</span>
                    </div>
                  )}
                  {r.summary && <p className="text-xs leading-6 text-muted-foreground">{r.summary}</p>}
                  {r.whyNow && r.status === "COMPLETED" && (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-200/80">لماذا الآن: {r.whyNow}</p>
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
