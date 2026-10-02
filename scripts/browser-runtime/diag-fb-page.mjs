// تشخيص: ماذا تعرض mbasic/www لصفحة جروب فيسبوك عام الآن؟
import { chromium } from "playwright"

const url = process.argv[2] || "https://mbasic.facebook.com/groups/224619592515112"
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" })
const page = await ctx.newPage()
const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e) => { console.log("goto error:", e.message.slice(0, 100)); return null })
console.log("final URL:", page.url())
console.log("status:", res?.status())
const html = await page.content()
console.log("html len:", html.length)
const loginWall = /تسجيل الدخول|log in to (facebook|continue)|login_form|checkpoint/i.test(html.slice(0, 4000))
console.log("login wall:", loginWall)
const counts = {
  "div[data-ft]": await page.locator("div[data-ft]").count(),
  "div.c": await page.locator("div.c").count(),
  "article": await page.locator("article").count(),
  "[role='article']": await page.locator("[role='article']").count(),
  "[role='feed']": await page.locator("[role='feed']").count(),
  "a[href*='permalink']": await page.locator("a[href*='permalink']").count(),
  "a[href*='/groups/']": await page.locator("a[href*='/groups/']").count(),
  "story div": await page.locator("div[data-ft], div.c, article, [role='article']").count(),
}
console.log("selectors:", JSON.stringify(counts))
// أول 500 حرف من النص
const text = await page.evaluate(() => (document.body?.innerText || "").slice(0, 500))
console.log("=== body text sample ===")
console.log(text)
await browser.close()
