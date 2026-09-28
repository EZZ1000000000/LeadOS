"use client";
// LeadOS — كارت عقل المهارات (نظرة سريعة على مين بيتعلم وإيه اللي اتذاكر)
import { useApi, fmtNum, timeAgo } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, Sparkles, GraduationCap } from "lucide-react"

interface SkillsData {
  skills: Array<{ platform: string; name: string; runs: number; leads: number; wins: number; results: number; weight: number; lastLeadAt: string | null }>
  lessons: Array<{ id: string; platform: string; query: string; leads: number; quality: number; source: string; createdAt: string }>
  lastSelection: { selectedBy: string | null; aiSmithTarget: string | null; at: string } | null
  ai: { dahl: boolean; nvidia: boolean; note: string }
}

export function SkillsBrainCard() {
  const { data } = useApi<SkillsData>("/api/skills")
  if (!data) return null

  const top = data.skills.filter((s) => s.runs > 0).slice(0, 6)
  const aiOn = data.ai.dahl || data.ai.nvidia

  return (
    <Card className="border-border/70">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-violet-400" />
          عقل المهارات
        </CardTitle>
        <span className="flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${aiOn ? "bg-emerald-500" : "bg-zinc-500"}`} />
          {data.lastSelection?.selectedBy === "ai-selector" ? "الـAI بيختار بنفسه" : "أوزان متعلمة"}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* أعلى المهارات وزنًا — النتايج الحقيقية بترفعها */}
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">لسه مفيش بيانات تعلم — أول نبضة جاية بتبدأ التغذية.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {top.map((s) => (
              <div key={s.platform} className="rounded-xl border border-border/60 bg-card p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-xs font-bold">{s.platform}</p>
                  <span className="text-[10px] text-muted-foreground">وزن {s.weight.toFixed(1)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-violet-500 to-fuchsia-500"
                    style={{ width: `${Math.min(100, (s.weight / 5) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {fmtNum(s.leads)} ليد / {fmtNum(s.runs)} جوب
                  {s.lastLeadAt ? ` • ${timeAgo(s.lastLeadAt)}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* الدروس المتعلمة — استعلامات جابت ليدز بترجع أولًا */}
        {data.lessons.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              دروس متعلمة (الاستعلام الفايت بيرجع أولًا)
            </p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {data.lessons.slice(0, 6).map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-accent/20 px-2 py-1.5">
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{l.platform}</span>
                  <p className="min-w-0 flex-1 truncate text-xs">{l.query}</p>
                  {l.source === "ai" && <Sparkles className="h-3 w-3 shrink-0 text-amber-400" />}
                  <span className="shrink-0 text-[10px] text-muted-foreground">{fmtNum(l.leads)} ليد</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
