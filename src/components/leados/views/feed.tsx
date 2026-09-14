"use client";
// LeadOS — Live Feed (doc §48.2)
import { useApi, timeAgo, SourceBadge, EmptyState, LoadingBlock } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, ExternalLink, User } from "lucide-react"

interface FeedItem {
  kind: "content" | "activity"
  id: string
  at: string
  title: string
  body: string
  type: string
  sourceName: string
  sourceType: string
  url: string | null
  status: string
  leadId: string | null
}

export function FeedView({ panel, onOpenLead }: { panel: string; onOpenLead: (id: string) => void }) {
  const { data, loading, refresh } = useApi<{ feed: FeedItem[] }>(`/api/feed?limit=50&panel=${panel}`)

  return (
    <Card className="border-border/70">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="live-dot h-2 w-2 rounded-full bg-primary" />
          <Radio className="h-4 w-4 text-primary" />
          البث المباشر — كل ما يكتشفه النظام لحظيًا
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh}>تحديث</Button>
      </CardHeader>
      <CardContent>
        {loading && !data ? <LoadingBlock /> : data?.feed.length === 0 ? (
          <EmptyState title="لا يوجد نشاط بعد" hint="شغّل دورة اكتشاف ليبدأ النظام جمع الإشارات" />
        ) : (
          <div className="relative space-y-3 before:absolute before:bottom-2 before:right-[15px] before:top-2 before:w-px before:bg-border">
            {data?.feed.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="relative flex gap-3">
                <div className={`z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  item.kind === "content"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-violet-500/30 bg-violet-500/10 text-violet-300"
                }`}>
                  {item.kind === "content" ? <Radio className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{item.title}</p>
                    <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                    {item.sourceType && <SourceBadge type={item.sourceType} />}
                    {item.status === "DUPLICATE" && (
                      <Badge className="bg-amber-500/15 text-[10px] text-amber-300">مكرر — تم الدمج</Badge>
                    )}
                    <span className="ms-auto text-[10px] text-muted-foreground">{timeAgo(item.at)}</span>
                  </div>
                  {item.body && <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{item.body}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    {item.kind === "content" && item.sourceName && (
                      <span className="text-[10px] text-muted-foreground/70">المصدر: {item.sourceName}</span>
                    )}
                    {item.leadId && (
                      <button className="text-[11px] font-bold text-primary hover:underline" onClick={() => onOpenLead(item.leadId!)}>
                        فتح ملف العميل ←
                      </button>
                    )}
                    {item.url && (
                      <a className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" href={item.url} target="_blank" rel="noreferrer">
                        الأصل <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
