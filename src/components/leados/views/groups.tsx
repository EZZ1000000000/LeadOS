"use client";
// LeadOS — تحدي الجروبات: مراقبة جروبات فيسبوك/تليجرام/ريديت/X
// يجيب المنشورات الجديدة، يقيّمها، يصنّفها للوحة الصح، ويحوّلها لعملاء.
import { useState } from "react"
import { useApi, apiSend, timeAgo, fmtNum, LoadingBlock, EmptyState, ScoreBadge, type ViewKey } from "../shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  MessageSquareDot, RefreshCw, Sparkles, Plus, Trash2, Pause, Play,
  ExternalLink, UserPlus, ThumbsDown, Radio, Users, ScanSearch, KeyRound, KeySquare,
} from "lucide-react"
import {
  GROUP_PLATFORM_LABELS, GROUP_STATUS_LABELS, POST_STATUS_LABELS,
  SEGMENT_LABELS,
} from "@/lib/constants"

type Panel = "CARDS" | "AGENCY"

interface GroupRow {
  id: string
  platform: string
  name: string
  url: string
  externalId: string
  segment: string
  status: string
  statusNote: string | null
  membersText: string | null
  intentScore: number
  activityScore: number
  postCount: number
  pendingPosts: number
  lastScannedAt: string | null
  lastPostAt: string | null
}

interface PostRow {
  id: string
  url: string | null
  author: string | null
  content: string
  postedAt: string | null
  detectedAt: string
  score: number
  segment: string
  matchedKeywords: string[]
  status: string
  leadId: string | null
  group: { id: string; name: string; platform: string; url: string }
}

interface GroupsData {
  groups: GroupRow[]
  meta: { facebookSession: boolean; apify: boolean; pendingPosts: number; convertedPosts: number }
}

interface PostsData {
  posts: PostRow[]
  counts: { new: number; qualified: number; converted: number }
}

const platformBadge = (p: string) =>
  p === "FACEBOOK" ? "bg-sky-500/15 text-sky-300 border-sky-500/40"
  : p === "TELEGRAM" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
  : p === "REDDIT" ? "bg-orange-500/15 text-orange-300 border-orange-500/40"
  : "bg-slate-500/15 text-slate-300 border-slate-500/40"

const statusBadge = (s: string) =>
  s === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
  : s === "NEEDS_SESSION" ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
  : s === "BLOCKED" ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
  : "bg-slate-500/15 text-slate-400 border-slate-500/30"

const segBadge = (s: string) =>
  s === "CARDS" ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
  : s === "AGENCY" ? "bg-violet-500/15 text-violet-300 border-violet-500/40"
  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"

export function GroupsView({ panel, onOpenLead }: { panel: Panel; onOpenLead: (id: string, view?: ViewKey) => void }) {
  const { toast } = useToast()
  const [tab, setTab] = useState("posts")

  // ---------- posts ----------
  const [postStatus, setPostStatus] = useState("ALL")
  const [minScore, setMinScore] = useState("0")
  const postsQuery = `/api/groups/posts?panel=${panel}&status=${postStatus}&minScore=${minScore}&limit=60`
  const { data: postsData, loading: postsLoading, refresh: refreshPosts } = useApi<PostsData>(postsQuery)

  // ---------- groups ----------
  const groupsQuery = `/api/groups?panel=${panel}`
  const { data: groupsData, loading: groupsLoading, refresh: refreshGroups } = useApi<GroupsData>(groupsQuery)

  const [scanning, setScanning] = useState(false)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const scanAll = async () => {
    setScanning(true)
    try {
      const res = await apiSend<{ scanned?: number; results?: Array<{ newPosts: number; name: string; status: string; note?: string }> }>("/api/groups/scan", "POST", {})
      const results = res.results ?? []
      const ok = results.filter((r) => r.newPosts > 0)
      const problems = results.filter((r) => r.status !== "OK")
      toast({
        title: `تم مسح ${results.length} جروب${ok.length ? ` — ${ok.reduce((a, r) => a + r.newPosts, 0)} منشور جديد` : ""}`,
        description: problems.length ? `مشاكل: ${problems.map((p) => `${p.name} (${p.status})`).join("، ")}` : undefined,
      })
      refreshPosts(); refreshGroups()
    } catch (e) {
      toast({ title: "المسح فشل", description: (e as Error).message })
    } finally {
      setScanning(false)
    }
  }

  const scanOne = async (id: string) => {
    setScanningId(id)
    try {
      const res = await apiSend<{ results: Array<{ newPosts: number; status: string; note?: string }> }>("/api/groups/scan", "POST", { groupId: id })
      const r = res.results[0]
      toast({ title: `${r.newPosts} منشور جديد — ${r.status}`, description: r.note })
      refreshPosts(); refreshGroups()
    } catch (e) {
      toast({ title: "المسح فشل", description: (e as Error).message })
    } finally {
      setScanningId(null)
    }
  }

  const convertPost = async (p: PostRow) => {
    setConvertingId(p.id)
    try {
      const res = await apiSend<{ lead: { id: string } | null; already?: boolean }>(`/api/groups/posts/${p.id}/convert`, "POST")
      toast({ title: res.already ? "ده كان متحوّل قبل كده" : "اتحوّل لعميل بنجاح ✅" })
      refreshPosts(); refreshGroups()
      if (res.lead?.id) onOpenLead(res.lead.id, "leads")
    } catch (e) {
      toast({ title: "التحويل فشل", description: (e as Error).message })
    } finally {
      setConvertingId(null)
    }
  }

  const rejectPost = async (p: PostRow) => {
    await apiSend(`/api/groups/posts/${p.id}`, "PATCH", { status: "REJECTED" }).catch(() => undefined)
    refreshPosts()
  }

  const changeGroup = async (id: string, body: Record<string, string>) => {
    await apiSend(`/api/groups/${id}`, "PATCH", body).catch(() => undefined)
    refreshGroups(); refreshPosts()
  }

  const deleteGroup = async (id: string) => {
    await apiSend(`/api/groups/${id}`, "DELETE").catch(() => undefined)
    refreshGroups(); refreshPosts()
  }

  const meta = groupsData?.meta

  return (
    <div className="space-y-5">
      {/* Header + integrations */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
            <MessageSquareDot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-extrabold leading-tight">تحدي الجروبات</h2>
            <p className="text-xs text-muted-foreground">نظام يدخل الجروبات ويجيب المنشورات الجديدة ويقيّمها ويحوّلها عملاء</p>
          </div>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={meta?.facebookSession ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}>
            <KeyRound className="me-1 h-3 w-3" />
            فيسبوك: {meta?.facebookSession ? "جلسة متصلة" : "بدون جلسة"}
          </Badge>
          <Badge variant="outline" className={meta?.apify ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border bg-secondary text-muted-foreground"}>
            <KeySquare className="me-1 h-3 w-3" />
            Apify {meta?.apify ? "متصل" : "غير مفعل"}
          </Badge>
          <Button onClick={scanAll} disabled={scanning} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            امسح الجروبات دلوقتي
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat title="منشورات جديدة" value={postsData?.counts.new ?? 0} icon={<Radio className="h-4 w-4 text-sky-400" />} tone="border-sky-500/30 bg-sky-500/10" />
        <MiniStat title="منشورات مؤهلة" value={postsData?.counts.qualified ?? 0} icon={<Sparkles className="h-4 w-4 text-amber-400" />} tone="border-amber-500/30 bg-amber-500/10" />
        <MiniStat title="محوّلة لعملاء" value={postsData?.counts.converted ?? 0} icon={<UserPlus className="h-4 w-4 text-emerald-400" />} tone="border-emerald-500/30 bg-emerald-500/10" />
        <MiniStat title="جروبات مراقبة" value={groupsData?.groups.length ?? 0} icon={<Users className="h-4 w-4 text-violet-400" />} tone="border-violet-500/30 bg-violet-500/10" />
      </div>

      {!meta?.facebookSession && !meta?.apify && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm text-amber-200">
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>
              جروبات فيسبوك محتاجة جلسة مسجلة عشان النظام يقدر يدخلها — ضيف <code className="rounded bg-black/30 px-1">FACEBOOK_SESSION_COOKIE</code> في إعدادات الاستضافة، أو <code className="rounded bg-black/30 px-1">APIFY_TOKEN</code> للمسار المدفوع الموثوق. تليجرام وريديت وX شغالين حالًا من غير حاجة.
            </span>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="posts">المنشورات</TabsTrigger>
          <TabsTrigger value="groups">الجروبات</TabsTrigger>
          <TabsTrigger value="discover">اكتشاف</TabsTrigger>
        </TabsList>

        {/* ==================== المنشورات ==================== */}
        <TabsContent value="posts" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={postStatus} onValueChange={setPostStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">كل الحالات</SelectItem>
                <SelectItem value="NEW">جديد</SelectItem>
                <SelectItem value="QUALIFIED">مؤهل</SelectItem>
                <SelectItem value="CONVERTED">محوّل لعميل</SelectItem>
                <SelectItem value="REJECTED">مرفوض</SelectItem>
              </SelectContent>
            </Select>
            <Select value={minScore} onValueChange={setMinScore}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">أي تقييم</SelectItem>
                <SelectItem value="50">Score + 50</SelectItem>
                <SelectItem value="70">Score + 70 (قوي)</SelectItem>
                <SelectItem value="85">Score + 85 (نار)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              لوحة {SEGMENT_LABELS[panel]} — تعرض {panel === "CARDS" ? "كافيهات وكروت نت" : "خدمات الأجنسي"} + «اللوحتين»
            </span>
          </div>

          {postsLoading && !postsData ? <LoadingBlock /> : (
            !postsData?.posts.length
              ? <EmptyState icon={<MessageSquareDot className="h-10 w-10" />} title="مفيش منشورات لسه" hint="ضيف جروبات من تاب «الجروبات» أو اكتشف جروبات جديدة من تاب «اكتشاف»، وبعدين دوس «امسح الجروبات»." />
              : (
                <div className="space-y-3">
                  {postsData.posts.map((p) => (
                    <Card key={p.id} className="border-border/70">
                      <CardContent className="p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={platformBadge(p.group.platform)}>{GROUP_PLATFORM_LABELS[p.group.platform] ?? p.group.platform}</Badge>
                          <span className="text-xs font-bold">{p.group.name}</span>
                          <Badge variant="outline" className={segBadge(p.segment)}>{SEGMENT_LABELS[p.segment] ?? p.segment}</Badge>
                          <ScoreBadge score={p.score} />
                          <Badge variant="outline" className="border-border bg-secondary text-xs text-muted-foreground">{POST_STATUS_LABELS[p.status] ?? p.status}</Badge>
                          <span className="ms-auto text-[11px] text-muted-foreground">
                            {p.postedAt ? `نُشر ${timeAgo(p.postedAt)}` : ""} · التقطه {timeAgo(p.detectedAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                          {p.content.length > 400 ? `${p.content.slice(0, 400)}…` : p.content}
                        </p>
                        {p.matchedKeywords.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.matchedKeywords.slice(0, 8).map((k) => (
                              <span key={k} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{k}</span>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {p.status === "CONVERTED" ? (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => onOpenLead(p.leadId!, "leads")}>
                              <UserPlus className="h-3.5 w-3.5" /> افتح العميل
                            </Button>
                          ) : (
                            <Button size="sm" className="gap-1" onClick={() => convertPost(p)} disabled={convertingId === p.id}>
                              <UserPlus className={`h-3.5 w-3.5 ${convertingId === p.id ? "animate-pulse" : ""}`} />
                              حوّله لعميل
                            </Button>
                          )}
                          {p.status !== "CONVERTED" && (
                            <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => rejectPost(p)}>
                              <ThumbsDown className="h-3.5 w-3.5" /> ارفض
                            </Button>
                          )}
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              المنشور الأصلي <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
          )}
        </TabsContent>

        {/* ==================== الجروبات ==================== */}
        <TabsContent value="groups" className="mt-4 space-y-4">
          <AddGroupCard onAdded={() => { refreshGroups(); refreshPosts() }} />

          {groupsLoading && !groupsData ? <LoadingBlock /> : (
            !groupsData?.groups.length
              ? <EmptyState icon={<Users className="h-10 w-10" />} title="مفيش جروبات مراقبة" hint="ضيف روابط جروبات يدويًا أو استخدم تاب الاكتشاف." />
              : (
                <div className="grid gap-3 md:grid-cols-2">
                  {groupsData.groups.map((g) => (
                    <Card key={g.id} className="border-border/70">
                      <CardContent className="p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={platformBadge(g.platform)}>{GROUP_PLATFORM_LABELS[g.platform] ?? g.platform}</Badge>
                          <Badge variant="outline" className={statusBadge(g.status)}>{GROUP_STATUS_LABELS[g.status] ?? g.status}</Badge>
                          <Badge variant="outline" className={segBadge(g.segment)}>{SEGMENT_LABELS[g.segment] ?? g.segment}</Badge>
                          {g.pendingPosts > 0 && (
                            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">{fmtNum(g.pendingPosts)} منشور جديد</Badge>
                          )}
                        </div>
                        <p className="truncate text-sm font-bold" title={g.name}>{g.name}</p>
                        <p dir="ltr" className="truncate text-[11px] text-muted-foreground">{g.url}</p>
                        {g.statusNote && <p className="mt-1 text-[11px] text-amber-300/90">{g.statusNote}</p>}

                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>النشاط (٧ أيام)</span>
                            <span>{g.activityScore}%</span>
                          </div>
                          <Progress value={g.activityScore} className="h-1.5" />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{fmtNum(g.postCount)} منشور إجمالي</span>
                          {g.membersText && <span>· {g.membersText}</span>}
                          <span>· آخر مسح: {g.lastScannedAt ? timeAgo(g.lastScannedAt) : "لسه"}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => scanOne(g.id)} disabled={scanningId === g.id}>
                            <ScanSearch className={`h-3 w-3 ${scanningId === g.id ? "animate-pulse" : ""}`} /> امسح
                          </Button>
                          <Select value={g.segment} onValueChange={(v) => changeGroup(g.id, { segment: v })}>
                            <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CARDS">كروت</SelectItem>
                              <SelectItem value="AGENCY">أجنسي</SelectItem>
                              <SelectItem value="BOTH">اللوحتين</SelectItem>
                            </SelectContent>
                          </Select>
                          {g.status === "ACTIVE" ? (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => changeGroup(g.id, { status: "PAUSED" })}>
                              <Pause className="h-3 w-3" /> إيقاف
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => changeGroup(g.id, { status: "ACTIVE" })}>
                              <Play className="h-3 w-3" /> تشغيل
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="ms-auto h-7 gap-1 text-xs text-rose-400 hover:text-rose-300" onClick={() => deleteGroup(g.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
          )}
        </TabsContent>

        {/* ==================== اكتشاف ==================== */}
        <TabsContent value="discover" className="mt-4">
          <DiscoverCard panel={panel} onDiscovered={() => { refreshGroups() }} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------- مكوّنات صغيرة ----------

function MiniStat({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xl font-extrabold leading-none">{fmtNum(value)}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AddGroupCard({ onAdded }: { onAdded: () => void }) {
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [segment, setSegment] = useState("BOTH")
  const [adding, setAdding] = useState(false)

  const add = async () => {
    if (!url.trim()) return
    setAdding(true)
    try {
      await apiSend("/api/groups", "POST", { url: url.trim(), segment })
      toast({ title: "الجروب اتضاف ✅", description: "دوس «امسح الجروبات» عشان يجيب أول دفعة منشورات" })
      setUrl("")
      onAdded()
    } catch (e) {
      toast({ title: "مش ضاف", description: (e as Error).message })
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card className="border-border/70">
      <CardContent className="flex flex-wrap items-center gap-2 p-4">
        <Input
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://facebook.com/groups/…  أو  t.me/…  أو  reddit.com/r/…  أو  x:كلمة"
          className="min-w-64 flex-1 text-left"
          onKeyDown={(e) => { if (e.key === "Enter") add() }}
        />
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CARDS">كروت</SelectItem>
            <SelectItem value="AGENCY">أجنسي</SelectItem>
            <SelectItem value="BOTH">اللوحتين</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={adding} className="gap-1.5">
          <Plus className={`h-4 w-4 ${adding ? "animate-spin" : ""}`} /> ضيف الجروب
        </Button>
      </CardContent>
    </Card>
  )
}

function DiscoverCard({ panel, onDiscovered }: { panel: Panel; onDiscovered: () => void }) {
  const { toast } = useToast()
  const [platform, setPlatform] = useState("FACEBOOK")
  const [keywords, setKeywords] = useState("كافيهات\nمقاهي\nمحتاج تسويق")
  const [segment, setSegment] = useState(panel === "CARDS" ? "CARDS" : "AGENCY")
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<{ created: Array<{ name: string; url: string; intentScore: number }>; skipped: number; note?: string } | null>(null)

  const discover = async () => {
    setWorking(true)
    setResult(null)
    try {
      const res = await apiSend<{ created: Array<{ name: string; url: string; intentScore: number }>; skipped: number; note?: string }>(
        "/api/groups/discover", "POST",
        { platform, keywords: keywords.split("\n").map((k) => k.trim()).filter(Boolean).slice(0, 4), segment },
      )
      setResult(res)
      toast({ title: `اتكتشف ${res.created.length} جروب جديد`, description: res.note })
      onDiscovered()
    } catch (e) {
      toast({ title: "الاكتشاف فشل", description: (e as Error).message })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            دوّر على جروبات جديدة بالكلمات المفتاحية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            النظام بيدور بحث حي عن جروبات عامة فيها جمهورك المستهدف — أسماء الجروبات مفهرسة على جوجل فبيلاقيها 10/10.
            اكتب كلمة في كل سطر (حتى 4 كلمات).
          </p>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FACEBOOK">جروبات فيسبوك</SelectItem>
              <SelectItem value="TELEGRAM">قنوات تليجرام</SelectItem>
              <SelectItem value="REDDIT">سبريدتات ريديت</SelectItem>
              <SelectItem value="X">مراقبة كلمات X</SelectItem>
            </SelectContent>
          </Select>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CARDS">لوحة الكروت (كافيهات)</SelectItem>
              <SelectItem value="AGENCY">لوحة الأجنسي</SelectItem>
              <SelectItem value="BOTH">اللوحتين</SelectItem>
            </SelectContent>
          </Select>
          <Textarea dir="rtl" value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={4} className="text-sm" />
          <Button onClick={discover} disabled={working} className="w-full gap-2">
            <Sparkles className={`h-4 w-4 ${working ? "animate-pulse" : ""}`} />
            {working ? "بيدوّر…" : "اكتشف جروبات"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">نتايج الاكتشاف</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <EmptyState icon={<ScanSearch className="h-8 w-8" />} title="لسه مفيش بحث" hint="اكتب كلمات واضغط اكتشف." />
          ) : result.created.length === 0 ? (
            <EmptyState title="مفيش جروبات جديدة اتحفظت" hint={result.note ?? "جرّب كلمات تانية."} />
          ) : (
            <div className="space-y-2">
              {result.created.map((c) => (
                <div key={c.url} className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{c.name}</p>
                    <p dir="ltr" className="truncate text-[10px] text-muted-foreground">{c.url}</p>
                  </div>
                  <ScoreBadge score={c.intentScore} />
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">{result.created.length} جروب اتضاف · {result.skipped} اتشطبوا (مكررين أو مش مناسبين)</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
