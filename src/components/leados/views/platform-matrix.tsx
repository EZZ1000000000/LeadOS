"use client";
// LeadOS — Platform Capability Matrix (SESSIONLESS MODE — طلب §28)
// تعرض لكل منصة: الوصول العام، الموثق، حالة الجلسة، آخر فحص، القدرة الحالية، البدائل
// بدون أي قيم كوكيز — حالات فقط.
import { useApi, apiSend, timeAgo, LoadingBlock } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ShieldCheck, RefreshCw } from "lucide-react"
import { useState } from "react"

interface MatrixRow {
  platform: string
  label: string
  publicSearch: string
  publicRead: string
  authenticatedRead: string
  authenticatedWrite: string
  needsSession: string
  sessionState: string
  sessionSource: string | null
  lastVerifiedAt: string | null
  currentCapability: "READY" | "PUBLIC_ONLY" | "NEEDS_SESSION" | "ERROR"
  fallback: string[]
  sessionOnlyOps: string[]
}
interface MatrixData {
  mode: "FULL" | "SESSIONLESS" | "DEGRADED" | "STOPPED"
  reason: string
  waitingJobs: number
  summary: { ready: number; publicOnly: number; needsSession: number; errors: number }
  rows: MatrixRow[]
}

const MODE_STYLES: Record<string, string> = {
  FULL: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  SESSIONLESS: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  DEGRADED: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  STOPPED: "border-rose-500/40 bg-rose-500/10 text-rose-300",
}
const MODE_LABELS: Record<string, string> = {
  FULL: "تشغيل كامل", SESSIONLESS: "بدون جلسات — مسارات عامة", DEGRADED: "متدهور", STOPPED: "موقوف",
}
const CAP_STYLES: Record<string, string> = {
  READY: "border-emerald-500/40 text-emerald-300",
  PUBLIC_ONLY: "border-sky-500/40 text-sky-300",
  NEEDS_SESSION: "border-amber-500/40 text-amber-300",
  ERROR: "border-rose-500/40 text-rose-300",
}
const CAP_LABELS: Record<string, string> = {
  READY: "جاهز", PUBLIC_ONLY: "عام فقط", NEEDS_SESSION: "محتاج جلسة", ERROR: "خطأ",
}
const SESSION_STATE_LABELS: Record<string, string> = {
  NOT_CONFIGURED: "غير مضافة", READY: "جاهزة", WARMING: "فحص معلق", EXPIRED: "منتهية",
  NEEDS_SESSION: "محتاج جلسة", BLOCKED: "محجوبة", ERROR: "خطأ", PAUSED: "موقوفة",
}
const TRI: Record<string, { txt: string; cls: string }> = {
  YES: { txt: "نعم", cls: "text-emerald-300" },
  PARTIAL: { txt: "جزئي", cls: "text-amber-300" },
  NO: { txt: "لا", cls: "text-muted-foreground" },
}

export function PlatformMatrixCard() {
  const { data, loading, refresh } = useApi<MatrixData>("/api/platforms")
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const verify = async (platform: string) => {
    setBusy(platform)
    try {
      const r = await apiSend<{ state: string; note: string }>("/api/platforms/sessions", "PATCH", { platform })
      toast({ title: `${platform}: ${SESSION_STATE_LABELS[r.state] ?? r.state} — ${r.note}` })
      refresh()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "فشل الفحص", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  if (loading && !data) return <LoadingBlock />
  if (!data) return null

  return (
    <Card className="border-border/70">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-sky-300" />
          مصفوفة قدرات المنصات
          <Badge className={MODE_STYLES[data.mode] ?? ""}>{MODE_LABELS[data.mode] ?? data.mode}</Badge>
          {data.waitingJobs > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-300">
              {data.waitingJobs} مهمة منتظرة جلسة
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" /> تحديث</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">{data.reason}</p>
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/40 text-muted-foreground">
                <th className="px-3 py-2 text-start font-bold">المنصة</th>
                <th className="px-2 py-2 text-center font-bold">بحث عام</th>
                <th className="px-2 py-2 text-center font-bold">قراءة عامة</th>
                <th className="px-2 py-2 text-center font-bold">قراءة موثقة</th>
                <th className="px-2 py-2 text-center font-bold">كتابة موثقة</th>
                <th className="px-2 py-2 text-center font-bold">الجلسة</th>
                <th className="px-2 py-2 text-center font-bold">آخر فحص</th>
                <th className="px-2 py-2 text-center font-bold">القدرة الحالية</th>
                <th className="px-3 py-2 text-start font-bold">البدائل</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.platform} className="border-b border-border/30 last:border-0 hover:bg-accent/30">
                  <td className="px-3 py-2">
                    <span className="font-bold">{r.label}</span>
                    <span className="ms-1.5 text-[10px] text-muted-foreground" dir="ltr">{r.platform}</span>
                  </td>
                  <td className={`px-2 py-2 text-center ${TRI[r.publicSearch]?.cls ?? ""}`}>{TRI[r.publicSearch]?.txt ?? r.publicSearch}</td>
                  <td className={`px-2 py-2 text-center ${TRI[r.publicRead]?.cls ?? ""}`}>{TRI[r.publicRead]?.txt ?? r.publicRead}</td>
                  <td className={`px-2 py-2 text-center ${TRI[r.authenticatedRead]?.cls ?? ""}`}>{TRI[r.authenticatedRead]?.txt ?? r.authenticatedRead}</td>
                  <td className={`px-2 py-2 text-center ${TRI[r.authenticatedWrite]?.cls ?? ""}`}>{TRI[r.authenticatedWrite]?.txt ?? r.authenticatedWrite}</td>
                  <td className="px-2 py-2 text-center">
                    <Badge variant="outline" className="border-border/60 text-[10px]">
                      {SESSION_STATE_LABELS[r.sessionState] ?? r.sessionState}{r.sessionSource === "env" ? " (env)" : ""}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-center text-[10px] text-muted-foreground">
                    {r.lastVerifiedAt ? timeAgo(r.lastVerifiedAt) : "—"}
                    {r.sessionState !== "NOT_CONFIGURED" && (
                      <button
                        className="ms-1 text-[10px] text-sky-300 underline-offset-2 hover:underline"
                        disabled={busy === r.platform}
                        onClick={() => verify(r.platform)}
                      >
                        {busy === r.platform ? "جارٍ…" : "فحص"}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Badge variant="outline" className={`${CAP_STYLES[r.currentCapability]} text-[10px]`}>
                      {CAP_LABELS[r.currentCapability] ?? r.currentCapability}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-[10px] leading-4 text-muted-foreground" dir="auto">
                    {r.fallback.slice(0, 2).join(" → ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">
          القاعدة: منصة واحدة فاشلة ≠ فشل النظام — غياب جلسة واحد ≠ توقف الاكتشاف.
          المنصات «محتاج جلسة» تنتظر بأمان، وعند إضافة الجلسة من الإعدادات تُفتح قدراتها تلقائيًا بدون تعديل كود.
        </p>
      </CardContent>
    </Card>
  )
}
