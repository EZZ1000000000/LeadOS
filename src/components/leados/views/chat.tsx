"use client";
// LeadOS — AI Commander chat (doc §5.1, §26)
import { useEffect, useRef, useState } from "react"
import { useApi, apiSend, apiGet, timeAgo, LoadingBlock } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Bot, Send, Wrench, Plus, MessageSquare, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface Msg {
  id: string
  role: string
  content: string
  toolCalls?: Array<{ tool: string; summary: string; ok: boolean }> | null
  createdAt: string
}
interface SessionRow {
  id: string
  title: string | null
  updatedAt: string
  _count: { messages: number }
}

const SUGGESTIONS = [
  "وريني كل الـHOT Leads ومين كلم فيهم؟",
  "أفضل 5 Leads عندي حاليًا؟",
  "وريني مطاعم الجيزة اللي محتاجة POS وScore فوق 85",
  "ما أفضل مصدر Leads حاليًا؟",
  "اعمل بحث عميق لعميل كافيه بينا",
  "خلي مهمة متابعة لعميل عيادة د. سارة بكرة",
]

export function ChatView() {
  const { data: sessionsData, refresh: refreshSessions } = useApi<{ sessions: SessionRow[]; ai: { nvidia: boolean; models?: { main?: string } } }>("/api/chat")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId) { setMessages([]); return }
    apiGet<{ messages: Msg[] }>(`/api/chat/${sessionId}`)
      .then((d) => setMessages(d.messages))
      .catch(() => undefined)
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, busy])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput("")
    setBusy(true)
    const optimistic: Msg = { id: `tmp-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() }
    setMessages((m) => [...m, optimistic])
    try {
      const res = await apiSend<{ sessionId: string; message: Msg }>("/api/chat", "POST", { message: content, sessionId })
      setSessionId(res.sessionId)
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), { ...optimistic, id: `u-${res.message.id}` }, res.message])
      refreshSessions()
    } catch (e) {
      setMessages((m) => [...m, {
        id: `err-${Date.now()}`, role: "assistant",
        content: e instanceof Error ? `تعذر الرد: ${e.message}` : "حدث خطأ",
        createdAt: new Date().toISOString(),
      }])
    } finally { setBusy(false) }
  }

  return (
    <div className="grid h-[calc(100vh-150px)] gap-3 lg:grid-cols-[260px_1fr]">
      {/* Sessions */}
      <Card className="hidden border-border/70 lg:flex lg:flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => { setSessionId(null); setMessages([]) }}>
            <Plus className="h-3.5 w-3.5" /> محادثة جديدة
          </Button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {sessionsData?.sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSessionId(s.id)}
                className={cn(
                  "w-full rounded-lg border p-2 text-start text-xs transition-colors",
                  sessionId === s.id ? "border-primary/40 bg-primary/10 font-bold text-primary" : "border-border/50 hover:bg-accent/40",
                )}
              >
                <span className="flex items-center gap-1.5 truncate"><MessageSquare className="h-3 w-3 shrink-0" /> {s.title ?? "محادثة"}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{timeAgo(s.updatedAt)}</span>
              </button>
            ))}
          </div>
          <p className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-[10px] leading-5 text-muted-foreground">
            محرك الذكاء: {sessionsData?.ai.nvidia ? `NVIDIA NIM ✓ (${sessionsData?.ai.models?.main ?? ""})` : "غير مضبوط"} — كل مودلات مجانية عبر راوتر المهام
          </p>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="flex min-h-0 flex-col border-border/70">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
              <Bot className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <p className="text-sm font-extrabold">AI Commander</p>
              <p className="text-[10px] text-muted-foreground">يحلل ويبحث ويعدّل عبر أدوات محددة الصلاحيات — بدون SQL خام</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-1">
            {messages.length === 0 && !busy && (
              <div className="space-y-3 py-6">
                <p className="text-center text-sm text-muted-foreground">جرّب أوامر زي:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-start flex-row" : "flex-row-reverse")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl border p-3 text-sm leading-7 whitespace-pre-wrap",
                  m.role === "user"
                    ? "border-border/60 bg-secondary/60"
                    : "border-violet-500/25 bg-violet-500/8",
                )}>
                  {m.role !== "user" && (
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold text-violet-300">
                      <Sparkles className="h-3 w-3" /> AI Commander
                    </p>
                  )}
                  {m.content}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                      {m.toolCalls.map((t, i) => (
                        <p key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Wrench className="h-3 w-3" />
                          <Badge variant="outline" className="font-mono text-[9px]" dir="ltr">{t.tool}</Badge>
                          {t.ok ? "✓" : "✗"} {t.summary}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                AI Commander بيشتغل...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-border pt-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="اكتب أمرًا... مثال: وريني كل كافيهات القاهرة اللي محتاجة POS"
              rows={1}
              className="max-h-32 min-h-10 resize-none"
            />
            <Button size="icon" onClick={() => send()} disabled={busy || !input.trim()} aria-label="إرسال">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
