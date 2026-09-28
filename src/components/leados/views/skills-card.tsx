"use client";
// LeadOS — كارت عقل المهارات (نظرة سريعة على مين بيتعلم وإيه اللي اتذاكر)
// + خريطة المهارات (skill-map): جراف المنصات والتكتيكات من الاستخدام الحقيقي
// + مكتبة GitSkills العالمية (3.8M مهارة — المحصود منها بيتعرض هنا)
import { useApi, fmtNum, timeAgo } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, Sparkles, GraduationCap, Globe, Network } from "lucide-react"

interface GraphNode {
  id: string
  kind: "platform" | "git"
  label: string
  platform?: string
  weight: number
  leads: number
  runs: number
  tags?: string
}
interface GraphLink {
  source: string
  target: string
  kind: "belongs" | "tactic" | "couse"
  weight: number
}
interface SkillsData {
  skills: Array<{ platform: string; name: string; runs: number; leads: number; wins: number; results: number; weight: number; lastLeadAt: string | null }>
  lessons: Array<{ id: string; platform: string; query: string; leads: number; quality: number; source: string; createdAt: string }>
  lastSelection: { selectedBy: string | null; aiSmithTarget: string | null; at: string } | null
  graph?: { nodes: GraphNode[]; links: GraphLink[]; builtAt: string | null }
  git?: {
    total: number
    lastHarvestAt: string | null
    top: Array<{ name: string; repo: string; description: string; tags: string; relevance: number; weight: number; useCount: number; leadCount: number }>
  }
  ai: { dahl: boolean; nvidia: boolean; note: string }
}

/** خريطة صغيرة حتمية: المنصات على دايرة + تكتيكات GitSkills جوه — الوصلات بينهم */
function MiniGraph({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const platforms = nodes.filter((n) => n.kind === "platform")
  const gits = nodes.filter((n) => n.kind === "git").slice(0, 8)
  if (!platforms.length) return null
  const W = 320
  const H = 200
  const cx = W / 2
  const cy = H / 2
  const R = 78
  const pos = new Map<string, { x: number; y: number }>()
  platforms.forEach((n, i) => {
    const a = (i / platforms.length) * Math.PI * 2 - Math.PI / 2
    pos.set(n.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) * 0.72 })
  })
  gits.forEach((n, i) => {
    const a = (i / Math.max(1, gits.length)) * Math.PI * 2 - Math.PI / 2 + 0.35
    pos.set(n.id, { x: cx + 34 * Math.cos(a), y: cy + 24 * Math.sin(a) })
  })
  const maxLeads = Math.max(1, ...platforms.map((n) => n.leads))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* الوصلات: co-use بين المنصات + tactic من GitSkills */}
      {links.filter((l) => l.kind === "couse").slice(0, 18).map((l, i) => {
        const a = pos.get(l.source)
        const b = pos.get(l.target)
        if (!a || !b) return null
        return <line key={`c${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(167,139,250,0.25)" strokeWidth={Math.max(0.6, l.weight)} />
      })}
      {links.filter((l) => l.kind === "tactic").slice(0, 24).map((l, i) => {
        const a = pos.get(l.source)
        const b = pos.get(l.target)
        if (!a || !b) return null
        return <line key={`t${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(251,191,36,0.35)" strokeWidth={0.8} />
      })}
      {/* عقد GitSkills — نقط صفرا صغيرة في النص */}
      {gits.map((n) => {
        const p = pos.get(n.id)
        if (!p) return null
        return <circle key={n.id} cx={p.x} cy={p.y} r={3.2} fill="rgba(251,191,36,0.85)" />
      })}
      {/* عقد المنصات — دايرة، حجمها بيكبر مع الليدز */}
      {platforms.map((n) => {
        const p = pos.get(n.id)
        if (!p) return null
        const r = 4 + (n.leads / maxLeads) * 7
        const hot = n.leads > 0
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={r} fill={hot ? "rgba(139,92,246,0.9)" : "rgba(113,113,122,0.5)"} />
            <text x={p.x} y={p.y - r - 3} textAnchor="middle" fontSize={6.5} fill="currentColor" opacity={0.75}>
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function SkillsBrainCard() {
  const { data } = useApi<SkillsData>("/api/skills")
  if (!data) return null

  const top = data.skills.filter((s) => s.runs > 0).slice(0, 6)
  const aiOn = data.ai.dahl || data.ai.nvidia
  const graph = data.graph
  const git = data.git

  return (
    <Card className="border-border/70">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-violet-400" />
          عقل المهارات
        </CardTitle>
        <span className="flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${aiOn ? "bg-emerald-500" : "bg-zinc-500"}`} />
          {data.lastSelection?.selectedBy === "ai-selector" ? "الـAI بيختار بنفسه" : "خريطة المهارات + أوزان متعلمة"}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* مكتبة GitSkills العالمية — دمج قاعدة 3.8M مهارة */}
        {git && git.total > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold">
                <Globe className="h-3.5 w-3.5 text-amber-400" />
                مكتبة GitSkills العالمية
              </p>
              <span className="text-[10px] text-muted-foreground">
                {fmtNum(git.total)} مهارة محصودة من 3.8M
              </span>
            </div>
            <div className="mt-1.5 space-y-1">
              {git.top.slice(0, 3).map((g) => (
                <div key={g.repo + g.name} className="flex items-center gap-2 rounded-lg bg-card/60 px-2 py-1">
                  <p className="min-w-0 flex-1 truncate text-[11px]">{g.name}</p>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{g.repo.split("/")[0]}</span>
                  <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[9px] text-amber-500">صلة {Math.round(g.relevance)}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              حصاد أخير {git.lastHarvestAt ? timeAgo(git.lastHarvestAt) : "—"} • التكتيكات بتتغذى في منتقي الـAI تلقائيًا
            </p>
          </div>
        )}

        {/* خريطة المهارات — جراف حي: بنفسجي = منصات (الحجم = الليدز) • أصفر = تكتيكات GitSkills */}
        {graph && graph.nodes.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Network className="h-3.5 w-3.5" />
              خريطة المهارات (منصات ⇄ تكتيكات ⇄ شراكات)
            </p>
            <div className="rounded-xl border border-border/60 bg-card p-1">
              <MiniGraph nodes={graph.nodes} links={graph.links} />
            </div>
          </div>
        )}

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
