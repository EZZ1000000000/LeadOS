// LeadOS — فحص العقل من جوه الإنتاج (محمي بـ?secret= زي tick)
// بيرجع حالة المزودين + نداء حي تجريبي — للتشخيص السريع من غير تدخيل
import { aiProviderStatus, aiChat } from "@/lib/ai"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get("secret") ?? ""
  const valid = secret && (secret === process.env.CRON_SECRET || secret === process.env.CRON_SECRET_ALT)
  if (!valid) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })

  const envProbe = {
    dahlKeyInEnv: Boolean(process.env.DAHL_API_KEY && process.env.DAHL_API_KEY.length > 20),
    nvidiaKeyInEnv: Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.length > 20),
  }
  const status = aiProviderStatus()
  const started = Date.now()
  const ping = await aiChat(
    [{ role: "user", content: "اكتب كلمة: تمام" }],
    { task: "classify", maxTokens: 300, temperature: 0.1 },
  )
  return Response.json({
    ok: true,
    envProbe,
    dahl: status.dahl,
    nvidiaKeys: status.keys,
    note: status.note,
    ping: ping
      ? { ok: true, provider: ping.provider, model: ping.model, latencyMs: ping.latencyMs, text: ping.text.slice(0, 60) }
      : { ok: false, elapsedMs: Date.now() - started },
  })
}
