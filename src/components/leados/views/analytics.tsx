"use client";
// LeadOS — Analytics (doc §34, §48.10)
import { useApi, fmtNum, LoadingBlock } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, CartesianGrid,
} from "recharts"
import { SOURCE_TYPE_LABELS, LEAD_SOURCE_TYPE_LABELS, industryAr } from "@/lib/constants"

interface AnalyticsData {
  funnel: { totalLeads: number; qualified: number; contacted: number; replied: number; meetings: number; proposals: number; won: number }
  rates: { contactRate: number; replyRate: number; meetingRate: number; wonRate: number; researchCompletion: number; duplicateRate: number }
  avgScore: number
  hot: number
  qualified: number
  bySource: Array<{ source: string; count: number; avgScore: number }>
  byIndustry: Array<{ name: string; count: number }>
  byCity: Array<{ name: string; count: number }>
  byService: Array<{ name: string; count: number }>
}

const COLORS = ["#2dd4a7", "#f59e0b", "#a78bfa", "#38bdf8", "#fb7185", "#34d399", "#fbbf24", "#c084fc"]

export function AnalyticsView() {
  const { data, loading } = useApi<AnalyticsData>("/api/analytics")

  if (loading && !data) return <LoadingBlock />
  if (!data) return null

  const funnelData = [
    { name: "مكتشفون", v: data.funnel.totalLeads },
    { name: "مؤهلون", v: data.funnel.qualified },
    { name: "تم التواصل", v: data.funnel.contacted },
    { name: "ردّوا", v: data.funnel.replied },
    { name: "اجتماعات", v: data.funnel.meetings },
    { name: "عروض", v: data.funnel.proposals },
    { name: "مكسوبة", v: data.funnel.won },
  ]
  const sourceData = data.bySource.map((s) => ({ name: SOURCE_TYPE_LABELS[s.source] ?? LEAD_SOURCE_TYPE_LABELS[s.source] ?? s.source, count: s.count, avgScore: s.avgScore }))
  const industryData = data.byIndustry.map((i) => ({ name: industryAr(i.name), count: i.count }))

  const rateCards = [
    { label: "معدل التواصل", v: data.rates.contactRate },
    { label: "معدل الرد", v: data.rates.replyRate },
    { label: "معدل الاجتماعات", v: data.rates.meetingRate },
    { label: "معدل الإغلاق", v: data.rates.wonRate },
    { label: "اكتمال الأبحاث", v: data.rates.researchCompletion },
    { label: "نسبة التكرار", v: data.rates.duplicateRate },
  ]

  return (
    <div className="space-y-4">
      {/* Rates */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {rateCards.map((r) => (
          <Card key={r.label} className="border-border/70">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-extrabold text-primary">{r.v}%</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{r.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Funnel */}
        <Card className="border-border/70">
          <CardHeader className="pb-2"><CardTitle className="text-base">قمع التحويل (Funnel)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 8, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
                <XAxis dataKey="name" tick={{ fill: "#8a97ab", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8a97ab", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#131a26", border: "1px solid #1f2a3a", borderRadius: 12, color: "#e6ebf2" }}
                  formatter={(v: number) => [fmtNum(v), "عدد"]}
                />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  {funnelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By source */}
        <Card className="border-border/70">
          <CardHeader className="pb-2"><CardTitle className="text-base">الـLeads حسب المصدر</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} margin={{ top: 8, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
                <XAxis dataKey="name" tick={{ fill: "#8a97ab", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8a97ab", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#131a26", border: "1px solid #1f2a3a", borderRadius: 12, color: "#e6ebf2" }}
                  formatter={(v: number, n: string) => n === "count" ? [fmtNum(v), "عدد الـLeads"] : [v, "متوسط Score"]}
                />
                <Bar dataKey="count" fill="#2dd4a7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By industry pie */}
        <Card className="border-border/70">
          <CardHeader className="pb-2"><CardTitle className="text-base">التوزيع حسب النشاط</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={industryData} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {industryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11, color: "#8a97ab" }} />
                <Tooltip contentStyle={{ background: "#131a26", border: "1px solid #1f2a3a", borderRadius: 12, color: "#e6ebf2" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By service */}
        <Card className="border-border/70">
          <CardHeader className="pb-2"><CardTitle className="text-base">أكثر الخدمات المطلوبة</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byService} layout="vertical" margin={{ top: 8, left: 16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
                <XAxis type="number" tick={{ fill: "#8a97ab", fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8a97ab", fontSize: 11 }} width={90} />
                <Tooltip
                  contentStyle={{ background: "#131a26", border: "1px solid #1f2a3a", borderRadius: 12, color: "#e6ebf2" }}
                  formatter={(v: number) => [fmtNum(v), "عملاء"]}
                />
                <Bar dataKey="count" fill="#a78bfa" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary strip */}
      <Card className="border-border/70">
        <CardContent className="flex flex-wrap items-center justify-around gap-4 p-4 text-center">
          <div><p className="text-2xl font-extrabold">{data.avgScore}</p><p className="text-[10px] text-muted-foreground">متوسط Score</p></div>
          <div><p className="text-2xl font-extrabold text-rose-400">{data.hot}</p><p className="text-[10px] text-muted-foreground">HOT Leads</p></div>
          <div><p className="text-2xl font-extrabold text-emerald-400">{data.qualified}</p><p className="text-[10px] text-muted-foreground">عملاء مؤهلون</p></div>
          <div><p className="text-2xl font-extrabold">{fmtNum(data.funnel.totalLeads)}</p><p className="text-[10px] text-muted-foreground">إجمالي مكتشفين</p></div>
          <div><p className="text-2xl font-extrabold text-amber-400">{data.rates.duplicateRate}%</p><p className="text-[10px] text-muted-foreground">تكرار تم منعه</p></div>
        </CardContent>
      </Card>
    </div>
  )
}
