"use client";
// LeadOS — نموذج ليدز عام (إنباوند + ريفيرال) — صفحة مستقلة بدون تسجيل دخول
// الاستخدام: /lead-form?ws=<workspace-slug>&ref=<كود الريفيرال>
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"

function LeadFormInner() {
  const params = useSearchParams()
  const ws = params.get("ws") ?? ""
  const ref = params.get("ref") ?? ""
  const [form, setForm] = useState({ name: "", phone: "", businessName: "", note: "", website: "" })
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("busy"); setError("")
    try {
      const res = await fetch("/api/ingest/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slug: ws, ref }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "حصل خطأ — جرب تاني")
      setState("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ")
      setState("error")
    }
  }

  if (!ws) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <p className="text-lg font-bold text-red-300">الرابط ناقص</p>
        <p className="mt-1 text-sm text-muted-foreground">الرابط ده محتاج معرّف الورشة — اطلب الرابط الصحيح مرة تانية.</p>
      </div>
    )
  }

  if (state === "done") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 text-lg font-bold text-emerald-300">تم استلام طلبك!</p>
        <p className="mt-2 text-sm text-muted-foreground">هنتواصل معاك في أقرب وقت — خليك متاح على الرقم اللي سجلته.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-3 rounded-2xl border border-border/70 bg-card p-6 shadow-lg">
      <div className="text-center">
        <h1 className="text-xl font-extrabold">سجّل بياناتك وهنتواصل معاك</h1>
        <p className="mt-1 text-xs text-muted-foreground">سيب بياناتك وهنكلمك نشرحلك التفاصيل — من غير أي التزام.</p>
      </div>
      {/* honeypot — مخفي عن البشر */}
      <input type="text" name="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
        className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="space-y-1">
        <label className="text-xs font-bold" htmlFor="lf-name">اسمك *</label>
        <input id="lf-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="مثال: أحمد محمد" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold" htmlFor="lf-phone">رقم الواتساب *</label>
        <input id="lf-phone" required dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="01xxxxxxxxx" inputMode="tel" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold" htmlFor="lf-biz">اسم البيزنس (لو عندك)</label>
        <input id="lf-biz" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="مثال: كافيه كورنر" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold" htmlFor="lf-note">محتاج إيه بالظبط؟</label>
        <textarea id="lf-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="مثال: عايز نظام طلبات للمطعم + كاشير" />
      </div>
      {state === "error" && <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}
      <button type="submit" disabled={state === "busy"}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
        {state === "busy" ? "جارٍ الإرسال..." : "ابعت بياناتي"}
      </button>
      <p className="text-center text-[10px] text-muted-foreground">بياناتك بتُستخدم للتواصل بخصوص طلبك بس.</p>
    </form>
  )
}

export default function LeadFormPage() {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-secondary/30 p-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}>
        <LeadFormInner />
      </Suspense>
    </main>
  )
}
