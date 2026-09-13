"use client";
// LeadOS — Login / Register screen
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Crosshair, ShieldCheck, Radar, BrainCircuit } from "lucide-react"

interface LoginScreenProps {
  onAuthed: () => void
}

export function LoginScreen({ onAuthed }: LoginScreenProps) {
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regWorkspace, setRegWorkspace] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const doLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "فشل تسجيل الدخول")
      onAuthed()
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع")
    } finally {
      setBusy(false)
    }
  }

  const doRegister = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, workspaceName: regWorkspace }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "فشل إنشاء الحساب")
      onAuthed()
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="leados-backdrop flex min-h-screen items-center justify-center bg-background p-4">
      <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-2 lg:items-center">
        {/* Brand side */}
        <div className="hidden flex-col gap-6 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30">
              <Crosshair className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">LeadOS</h1>
              <p className="text-xs text-muted-foreground">منصة ذكاء العملاء المحتملين</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            نظام يعمل 24/7 لاكتشاف العملاء المحتملين من الويب وخرائط جوجل والسوشيال،
            يحللهم بالذكاء الاصطناعي، يجري بحثًا عميقًا لكل Lead مهم، ويدير دورة البيع كاملة من أول اكتشاف حتى الإغلاق.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Radar className="h-5 w-5 text-primary" />
              <span>اكتشاف آلي مستمر مع منع التكرار بين المصادر</span>
            </li>
            <li className="flex items-center gap-3">
              <BrainCircuit className="h-5 w-5 text-primary" />
              <span>تصنيف النية الشراء + فرص الخدمات لكل عميل</span>
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>كل معلومة موثقة بمصدرها (Evidence) وموثوقيتها</span>
            </li>
          </ul>
        </div>

        {/* Auth card */}
        <Card className="border-border/80 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crosshair className="h-5 w-5 text-primary" />
              أهلاً بك في LeadOS
            </CardTitle>
            <CardDescription>سجّل الدخول للمتابعة أو أنشئ حسابًا جديدًا</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="register">حساب جديد</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">البريد الإلكتروني</Label>
                  <Input id="login-email" dir="ltr" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">كلمة المرور</Label>
                  <Input id="login-password" dir="ltr" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
                </div>
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  أول مرة؟ أنشئ حسابك من تبويب «حساب جديد» وسيتم تجهيز مساحة عملك وخط المبيعات تلقائيًا
                </p>
                <Button className="w-full" onClick={doLogin} disabled={busy}>
                  {busy ? "جارٍ الدخول..." : "دخول"}
                </Button>
              </TabsContent>

              <TabsContent value="register" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">الاسم</Label>
                  <Input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="اسمك الكامل" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">البريد الإلكتروني</Label>
                  <Input id="reg-email" dir="ltr" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">كلمة المرور</Label>
                  <Input id="reg-password" dir="ltr" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-ws">اسم مساحة العمل</Label>
                  <Input id="reg-ws" value={regWorkspace} onChange={(e) => setRegWorkspace(e.target.value)} placeholder="مثال: وكالة النمو الرقمي" />
                </div>
                <Button className="w-full" onClick={doRegister} disabled={busy}>
                  {busy ? "جارٍ الإنشاء..." : "إنشاء الحساب والبدء"}
                </Button>
              </TabsContent>
            </Tabs>

            {error && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
