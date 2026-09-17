// LeadOS — /api/agent/browse (أيد الستيلث Camoufox)
// GET  → حالة الخدمة والمتصفح
// POST → تصفح/استخراج/تفاعل عبر المتصفح المضاد للبصمة
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { stealthHealth, stealthNavigate, stealthExtract, stealthAct, ensureStealth } from "@/lib/agent/stealth-browser"

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
          const { mkdir, writeFile } = await import("node:fs/promises")
          const dir = "/home/z/my-project/download/stealth"
          await mkdir(dir, { recursive: true })
          screenshotPath = `${dir}/shot-${Date.now()}.png`
          await writeFile(screenshotPath, Buffer.from(nav.screenshot, "base64"))
        } catch {
          /* تجاهل */
        }
      }
      return json({ ...nav, screenshotPath })
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
