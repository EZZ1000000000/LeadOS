// لقطة واجهة زيزو للتحقق من بادج خبرة البيع
import { chromium } from "playwright"

const base = "http://localhost:3000"
const b = await chromium.launch({ headless: true })
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })

// دخول
await page.goto(`${base}/`, { waitUntil: "networkidle" })
const isLogin = await page.locator("#login-email").count()
if (isLogin > 0) {
  await page.locator("#login-email").fill("admin@leados.eg")
  await page.locator("#login-password").fill("Zizo@2026")
  await page.waitForTimeout(500)
  await page.getByRole("button", { name: "دخول", exact: true }).click()
  await page.waitForTimeout(4500)
  if (await page.locator("#login-email").count()) {
    await page.keyboard.press("Enter")
    await page.waitForTimeout(4000)
  }
}

// فتح تاب زيزو
const zizoTab = page.locator("button, a").filter({ hasText: /زيزو|Zizo/i }).first()
if (await zizoTab.count()) {
  await zizoTab.click().catch(() => undefined)
  await page.waitForTimeout(2500)
}

// البادج الجديد
const badge = page.locator("text=خبرة البيع").first()
const visible = (await badge.count()) > 0
const txt = visible ? await badge.textContent() : "(مش ظاهر)"
console.log(`بادج خبرة البيع: ${visible ? "✅ ظاهر" : "❌"} — «${txt?.trim()}»`)

await page.screenshot({ path: "/home/z/my-project/scripts/ui-zizo-expertise.png", fullPage: false })
console.log("📸 scripts/ui-zizo-expertise.png")
await b.close()
