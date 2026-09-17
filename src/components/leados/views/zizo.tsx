"use client"
// LeadOS — زيزو: إنبوكس كيان البيع الذاتي
// محادثات زيزو مع العملاء + نبضة يدوية + إعدادات مبادرة + مشاهدة الردود البشرية
import { useCallback, useEffect, useRef, useState } from "react"
import { apiGet, apiSend, useApi, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import {
  MessagesSquare, RefreshCw, Send, CalendarCheck, Flame, Inbox, Sparkles,
  PhoneCall, X, CheckCheck, MessageSquarePlus,
} from "lucide-react"

const STAGE_LABELS: Record<string, string> = {
  NEW: "جديد", ENGAGED: "بيتكلم", INTERESTED: "مهتم", OFFERED: "اتعرض عليه",
  OBJECTION: "اعتراض", CALL_BOOKED: "لايف كول ✅", LOST: "خسارة",
}
const STAGE_COLORS: Record<string, string> = {
  NEW: "bg-slate-500/15 text-slate-300", ENGAGED: "bg-sky-500/15 text-sky-300",
  INTERESTED: "bg-indigo-500/15 text-indigo-300", OFFERED: "bg-violet-500/15 text-violet-300",
  OBJECTION: "bg-amber-500/15 text-amber-300", CALL_BOOKED: "bg-emerald-500/15 text-emerald-300",
  LOST: "bg-rose-500/15 text-rose-300",
}

interface ConvRow {
  id: string
  contactName: string | null
  channel: string
  stage: string
  status: string
  lastMsgAt: string
  msgCount: number
  bookedAt: string | null
  memo: string | null
  lead?: { score: number; business?: { name: string; city: string } | null }
}
interface StatusPayload {
  open: number; needsReply: number; waiting: number; booked: number; lost: number; fuel: number
  whatsapp: boolean
  stages: Array<{ stage: string; count: number }>
  conversations: ConvRow[]
  config: { agencyName: string; autoOutreach: boolean; minOutreachScore: number; maxDailyOutreach: number; liveCallHours: string }
  services: Array<{ id: string; name: string; pitch: string }>
}
interface Msg {
  id: string; direction: string; author: string; body: string; sentAt: string; deliverMs: number | null
}
interface ConvDetail {
  conversation: ConvRow & { contactHandle: string | null; lang: string; lead?: { id: string; score: number } | null; messages: Msg[] }
}

export function ZizoView() {
  const { data, loading, error, refresh: reload } = useApi<StatusPayload>("/api/agent/zizo")
  const [sel, setSel] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConvDetail["conversation"] | null>(null)
  const [replying, setReplying] = useState(false)
  const [ticking, setTicking] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [agencyName, setAgencyName] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (data && !agencyName) setAgencyName(data.config.agencyName) }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const openConv = useCallback(async (id: string) => {
    setSel(id)
    setDetail(null)
    const d = await apiGet<ConvDetail>(`/api/agent/zizo?conversation=${id}`)
    setDetail(d.conversation)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [detail])

  const zizoReply = async () => {
    if (!sel) return
    setReplying(true)
    try {
      await apiSend("/api/agent/zizo", "POST", { action: "reply", conversationId: sel })
      await openConv(sel)
      reload()
    } finally { setReplying(false) }
  }

  const sendClientMsg = async () => {
    if (!sel || !draft.trim()) return
    setSending(true)
    try {
      await apiSend("/api/agent/zizo", "POST", { action: "client_msg", conversationId: sel, body: draft.trim() })
      setDraft("")
      await openConv(sel)
      reload()
    } finally { setSending(false) }
  }

  const tickNow = async () => {
    setTicking(true)
    try { await apiSend("/api/agent/zizo", "POST", { action: "tick" }); reload() }
    finally { setTicking(false) }
  }

  const saveConfig = async (patch: Record<string, unknown>) => {
    await apiSend("/api/agent/zizo", "POST", { action: "config", ...patch })
    reload()
  }

  const closeConv = async (won: boolean) => {
    if (!sel) return
    await apiSend("/api/agent/zizo", "POST", { action: "close", conversationId: sel, won })
    await openConv(sel)
    reload()
  }

  if (loading) return <LoadingBlock label="جارٍ إحضار محادثات زيزو..." />
  if (error) return <EmptyState title="تعذر تحميل حالة زيزو" hint={String(error)} />
  if (!data) return <EmptyState title="لا بيانات" />

  const s = data
  return (
    <div className="flex h-full flex-col gap-4">
      {/* شريط الحالة */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard icon={<Inbox className="h-4 w-4" />} label="محادثات مفتوحة" value={s.open} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="مستنية رد زيزو" value={s.needsReply} warn={s.needsReply > 0} />
        <StatCard icon={<PhoneCall className="h-4 w-4" />} label="لايف كولز محجوزة" value={s.booked} good={s.booked > 0} />
        <StatCard icon={<X className="h-4 w-4" />} label="خسائر" value={s.lost} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="وقود مبادرات" value={s.fuel} hint={`سكور ≥ ${s.config.minOutreachScore}`} />
      </div>

      {/* إعدادات + أزرار */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-3 text-sm">
        <span className="text-muted-foreground">الوكالة:</span>
        <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="h-8 w-40" placeholder="اسم وكالتك" />
        <Button size="sm" variant="outline" className="h-8" onClick={() => saveConfig({ agencyName })}>حفظ</Button>
        <Button size="sm" variant={s.config.autoOutreach ? "default" : "outline"} className="h-8"
          onClick={() => saveConfig({ autoOutreach: !s.config.autoOutreach })}>
          مبادرة تلقائية: {s.config.autoOutreach ? "شغالة" : "واقفة"}
        </Button>
        <Badge variant="outline" className="h-6">
          {s.whatsapp ? "واتساب مربوط ✅" : "إنبوكس يدوي (واتساب غير مربوط)"}
        </Badge>
        <div className="flex-1" />
        <Button size="sm" className="h-8" onClick={tickNow} disabled={ticking}>
          <RefreshCw className={`ml-1 h-3.5 w-3.5 ${ticking ? "animate-spin" : ""}`} />
          {ticking ? "زيزو شغال..." : "نبضة زيزو الآن"}
        </Button>
      </div>

      {/* الإنشوجن إنبوكس */}
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[320px_1fr]">
        {/* قائمة المحادثات */}
        <Card className="flex min-h-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground">المحادثات ({s.conversations.length})</span>
              <button onClick={reload} className="text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1.5">
                {s.conversations.map((c) => (
                  <button key={c.id} onClick={() => openConv(c.id)}
                    className={`w-full rounded-lg border p-2.5 text-right transition ${sel === c.id ? "border-primary/60 bg-primary/10" : "border-border/50 hover:bg-accent/40"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{c.contactName || c.lead?.business?.name || "عميل"}</span>
                      <Badge className={`px-1.5 text-[10px] ${STAGE_COLORS[c.stage] ?? ""}`}>{STAGE_LABELS[c.stage] ?? c.stage}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{c.channel === "WHATSAPP" ? "واتساب" : "إنبوكس"} • {c.msgCount} رسالة</span>
                      <span>{timeAgo(c.lastMsgAt)}</span>
                    </div>
                    {c.status === "NEEDS_REPLY" && <div className="mt-1 text-[10px] font-bold text-amber-400">⚡ مستني رد زيزو</div>}
                    {c.bookedAt && <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-400"><CalendarCheck className="h-3 w-3" /> لايف كول محجوز</div>}
                  </button>
                ))}
                {!s.conversations.length && <EmptyState icon={<MessagesSquare className="h-8 w-8" />} title="مفيش محادثات بعد" hint="دوس «نبضة زيزو» — هيبادر مع الليدز الحلوة بنفسه" />}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* لوحة المحادثة */}
        <Card className="flex min-h-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col p-3">
            {!sel || !detail ? (
              <EmptyState icon={<MessagesSquare className="h-10 w-10" />} title="اختار محادثة" hint="هتشوف ردود زيزو البشرية ورسايل العميل" />
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
                  <span className="font-bold">{detail.contactName || "عميل"}</span>
                  <Badge className={`px-1.5 text-[10px] ${STAGE_COLORS[detail.stage] ?? ""}`}>{STAGE_LABELS[detail.stage] ?? detail.stage}</Badge>
                  {detail.lead && <Badge variant="outline" className="text-[10px]">سكور {detail.lead.score}</Badge>}
                  <div className="flex-1" />
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={zizoReply} disabled={replying}>
                    <Sparkles className="ml-1 h-3 w-3" />{replying ? "زيزو بيفكر..." : "خلي زيزو يرد"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-400" onClick={() => closeConv(true)}><CheckCheck className="ml-1 h-3 w-3" />قفل كفوز</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-rose-400" onClick={() => closeConv(false)}><X className="ml-1 h-3 w-3" />قفل كخسارة</Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-2 p-1">
                    {detail.messages.map((m) => {
                      const out = m.direction === "OUT"
                      return (
                        <div key={m.id} className={`flex ${out ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${out ? "bg-primary/15 text-foreground" : "bg-accent/60 text-foreground"}`}>
                            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="font-bold">{out ? (m.author === "ZIZO" ? "زيزو" : "موظف") : "العميل"}</span>
                              <span>{timeAgo(m.sentAt)}</span>
                              {m.deliverMs ? <span className="opacity-60">(كتبها في {Math.round(m.deliverMs / 1000)}ث)</span> : null}
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>
                {/* إدخال رسالة عميل (إنبوكس يدوي/محاكاة) */}
                <div className="mt-2 flex items-center gap-2 border-t border-border/50 pt-2">
                  <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendClientMsg()}
                    placeholder="اكتب رسالة العميل... زيزو هيرد عليها طبيعي" className="h-9" />
                  <Button size="sm" className="h-9" onClick={sendClientMsg} disabled={sending || !draft.trim()}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, warn, good, hint }: { icon: React.ReactNode; label: string; value: number; warn?: boolean; good?: boolean; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={`rounded-lg p-2 ${warn ? "bg-amber-500/15 text-amber-400" : good ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary"}`}>{icon}</div>
        <div>
          <div className="text-xl font-black leading-none">{value}</div>
          <div className="text-[11px] text-muted-foreground">{label}{hint ? ` • ${hint}` : ""}</div>
        </div>
      </CardContent>
    </Card>
  )
}
