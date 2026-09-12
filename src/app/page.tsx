"use client";
// LeadOS — root SPA page (only user-visible route)
import { useEffect, useState } from "react"
import { AppShell } from "@/components/leados/app-shell"
import { LoginScreen } from "@/components/leados/login-screen"
import { apiGet, type Me } from "@/components/leados/shared"
import { Crosshair } from "lucide-react"

export default function Page() {
  const [me, setMe] = useState<Me | null | "loading">("loading")

  const loadMe = () => {
    apiGet<Me>("/api/me")
      .then((d) => setMe(d))
      .catch(() => setMe(null))
  }

  useEffect(loadMe, [])

  if (me === "loading") {
    return (
      <div className="leados-backdrop flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl border border-primary/30 bg-primary/15">
          <Crosshair className="h-9 w-9 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">جارٍ تحضير LeadOS...</p>
      </div>
    )
  }

  if (me === null) return <LoginScreen onAuthed={loadMe} />

  return <AppShell me={me} onLogout={() => setMe(null)} />
}
