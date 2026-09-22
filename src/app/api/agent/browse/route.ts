// LeadOS — /api/agent/browse (أيد الستيلث Camoufox)
// GET  → حالة الخدمة والمتصفح
// POST → تصفح/استخراج/تفاعل/تحليل بصري عبر المتصفح المضاد للبصمة
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { stealthHealth, stealthNavigate, stealthExtract, stealthAct, ensureStealth } from "@/lib/agent/stealth-browser"
import { aiVision } from "@/lib/ai"

type Body = Record<string, unknown>

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const h = await stealthHealth()
  return json({ ok: true, ...h })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = ((await readBody<Body>(req).catch(() => null)) ?? {}) as Body
  const action = String(body.action ?? "goto").toLowerCase()

  // التشغيل التلقائي للخدمة لو معطلة (dev/self-host) — على Vercel يرجع STEALTH_UNAVAILABLE
  if (action !== "health" && !(await ensureStealth())) {
    return jsonError("خدمة Camoufox غير متاحة — على Vercel اضبط CAMOUFOX_URL على خادم خارجي يشغّل scripts/camoufox-service.py", 503)
  }

  try {
    if (action === "health") {
      const h = await stealthHealth()
      return json({ ok: h.online, ...h })
    }
    if (action === "goto") {
      const url = String(body.url ?? "")
      if (!/^https?:\/\//.test(url)) return jsonError("URL غير صالح", 400)
      const nav = await stealthNavigate({
        url,
        wait_until: body.wait_until as "domcontentloaded" | "load" | "networkidle" | undefined,
        timeout: Number(body.timeout ?? 45_000),
        screenshot: Boolean(body.screenshot),
        full_page: Boolean(body.full_page),
        scroll_times: Number(body.scroll_times ?? 0),
        session: String(body.session ?? "default"),
      })
      // حفظ السكرين شوت كملف اختياريًا
      let screenshotPath: string | undefined
      if (nav.ok && nav.screenshot && body.save) {
        try {
          const { mkdir, writeFile } = await import("fs/promises")
          const path = await import("path")
          const dir = path.join(process.cwd(), "download", "stealth")
          await mkdir(dir, { recursive: true })
          screenshotPath = `${dir}/shot-${Date.now()}.png`
          await writeFile(screenshotPath, Buffer.from(nav.screenshot, "base64"))
        } catch {
          /* تجاهل */
        }
      }
      // تحليل بصري اختياري للسكرين شوت (رؤية NVIDIA — يسأل عن الصفحة مباشرة)
      let analysis: string | undefined
      if (nav.ok && nav.screenshot && body.analyze) {
        const question = String(body.question ?? "حلل هذه الصفحة: هوية الموقع، أي أرقام تواصل، عروض أو فرص عمل، وحالة النشاط التجاري")
        const v = await aiVision(question, `data:image/png;base64,${nav.screenshot}`, { workspaceId: auth.workspace.id, runType: "OTHER" })
        analysis = v?.text.slice(0, 2500)
      }
      return json({ ...nav, screenshotPath, analysis })
    }
    if (action === "extract") {
      const selector = String(body.selector ?? "")
      if (!selector) return jsonError("selector مطلوب", 400)
      const r = await stealthExtract({
        selector,
        attr: String(body.attr ?? "innerText"),
        limit: Number(body.limit ?? 50),
        session: String(body.session ?? "default"),
      })
      return json(r)
    }
    if (action === "analyze") {
      // تحليل صورة مباشرة (data URL) بمحرك الرؤية — بدون تصفح
      const image = String(body.image ?? "")
      if (!image.startsWith("data:")) return jsonError("image لازم data URL (أو استخدم action=goto مع analyze)", 400)
      const question = String(body.question ?? "حلل الصورة واستخرج أي معلومات مهمة")
      const v = await aiVision(question, image, { workspaceId: auth.workspace.id, runType: "OTHER" })
      if (!v) return jsonError("محرك الرؤية مش متاح حاليًا", 502)
      return json({ ok: true, model: v.model, analysis: v.text.slice(0, 2500), latencyMs: v.latencyMs })
    }
    if (["click", "type", "press", "scroll", "wait", "eval", "screenshot"].includes(action)) {
      const r = await stealthAct({
        action,
        selector: body.selector ? String(body.selector) : undefined,
        text: body.text ? String(body.text) : undefined,
        key: body.key ? String(body.key) : undefined,
        script: body.script ? String(body.script) : undefined,
        amount: body.amount ? Number(body.amount) : undefined,
        timeout: body.timeout ? Number(body.timeout) : undefined,
        session: String(body.session ?? "default"),
      })
      return json(r)
    }
    return jsonError(`عملية غير معروفة: ${action}`, 400)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message.slice(0, 200) : "خطأ غير متوقع", 500)
  }
}
